package sh.celia.novella.modules.novellaui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.os.Trace
import android.util.LruCache
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * Decoded placeholder cache. Cover placeholders are 32x48 (~6KB each), so 256
 * entries cost well under 2MB while removing every repeated decode: grids
 * re-mount the same covers constantly while scrolling and recycling.
 *
 * Bitmaps are immutable and only ever read, so handing the same instance to
 * several ImageViews is safe; eviction merely drops our reference because the
 * views still hold theirs.
 */
private object BlurHashBitmaps {
  private const val MAX_ENTRIES = 256
  private val cache = LruCache<String, Bitmap>(MAX_ENTRIES)

  fun get(blurHash: String, width: Int, height: Int): Bitmap? {
    if (blurHash.isEmpty()) return null
    val key = "$blurHash|$width|$height"
    cache.get(key)?.let { return it }
    Trace.beginSection("NovellaBlurHash.decode")
    val bitmap = try {
      decodeWithExpoImage(blurHash, width, height)
    } finally {
      Trace.endSection()
    }
    if (bitmap != null) cache.put(key, bitmap)
    return bitmap
  }

  private fun decodeWithExpoImage(blurHash: String, width: Int, height: Int): Bitmap? =
    runCatching {
      // expo-image is autolinked into Expo's aggregated Android module and is not
      // available as a separate Gradle project dependency in SDK 57. Resolve its
      // bundled decoder at runtime so this adapter can select useCache=false
      // without copying the BlurHash algorithm or moving pixels through JS.
      //
      // Expo Image's own cosine cache is keyed only by dimension * component
      // count, so different dimension/component pairs collide and produce black
      // bands. We keep Expo's decoder but bypass that unsafe global cache and
      // memoise the finished bitmaps here instead.
      val decoderClass = Class.forName("expo.modules.image.blurhash.BlurhashDecoder")
      val decoder = decoderClass.getField("INSTANCE").get(null)
      val decode = decoderClass.getMethod(
        "decode",
        String::class.java,
        Int::class.javaPrimitiveType,
        Int::class.javaPrimitiveType,
        Float::class.javaPrimitiveType,
        Boolean::class.javaPrimitiveType
      )
      decode.invoke(decoder, blurHash, width, height, 1f, false) as? Bitmap
    }.getOrNull()
}

/**
 * Plain View-backed BlurHash placeholder.
 *
 * The bitmap is drawn by this view itself rather than by a child ImageView:
 * React Native sizes the exported view but never measures its native children,
 * which left a child collapsed in the corner instead of filling the tile.
 */
class BlurHashView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
  private val destination = Rect()

  private var bitmap: Bitmap? = null
  private var blurHash: String = ""
  private var decodeWidth: Int = 32
  private var decodeHeight: Int = 48

  init {
    setWillNotDraw(false)
  }

  fun setBlurHash(value: String) {
    if (value == blurHash) return
    blurHash = value
    render()
  }

  fun setDecodeWidth(value: Int) {
    val next = value.coerceIn(1, 128)
    if (next == decodeWidth) return
    decodeWidth = next
    render()
  }

  fun setDecodeHeight(value: Int) {
    val next = value.coerceIn(1, 128)
    if (next == decodeHeight) return
    decodeHeight = next
    render()
  }

  override fun onDraw(canvas: Canvas) {
    val current = bitmap ?: return
    // Placeholder and tile share the cover aspect ratio, so filling the bounds
    // matches the previous ContentScale.Crop without any cropping maths.
    destination.set(0, 0, width, height)
    canvas.drawBitmap(current, null, destination, paint)
  }

  private fun render() {
    bitmap = BlurHashBitmaps.get(blurHash, decodeWidth, decodeHeight)
    invalidate()
  }
}
