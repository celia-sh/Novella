@file:OptIn(org.readium.r2.shared.ExperimentalReadiumApi::class)

package sh.celia.novella.modules.readium

import android.content.Context
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.view.View
import android.view.ViewGroup.LayoutParams
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.commitNow
import androidx.lifecycle.lifecycleScope
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import org.readium.r2.navigator.HyperlinkNavigator
import org.readium.r2.navigator.epub.EpubNavigatorFactory
import org.readium.r2.navigator.epub.EpubNavigatorFragment
import org.readium.r2.navigator.epub.EpubPreferences
import org.readium.r2.navigator.preferences.Color
import org.readium.r2.shared.publication.Link
import org.readium.r2.shared.publication.Locator
import org.readium.r2.shared.publication.Publication
import org.readium.r2.shared.toJSON
import org.readium.r2.shared.util.AbsoluteUrl
import org.readium.r2.shared.util.Url
import org.readium.r2.shared.util.data.ReadError
import org.readium.r2.shared.util.file.DirectoryContainer
import org.readium.r2.shared.util.getOrElse
import org.readium.r2.shared.util.http.DefaultHttpClient
import org.readium.r2.shared.util.mediatype.MediaType
import org.readium.r2.streamer.PublicationOpener
import org.readium.r2.streamer.parser.DefaultPublicationParser

class ComposeReadiumView(context: Context, appContext: AppContext) : ExpoView(context, appContext), EpubNavigatorFragment.Listener {
  override val shouldUseAndroidLayout = true

  private val onReady by EventDispatcher()
  private val onLocatorChange by EventDispatcher()
  private val onLink by EventDispatcher()
  private val onError by EventDispatcher()

  private var publicationUri: String? = null
  private var publicationId: String? = null
  private var declaredHrefs: List<String> = emptyList()
  private var initialLocator: Map<String, Any>? = null
  private var preferences: Map<String, Any> = emptyMap()
  private var navigator: EpubNavigatorFragment? = null
  private var publication: Publication? = null
  private var openJob: Job? = null
  private var locatorJob: Job? = null
  private val fragmentTag get() = "novella-readium-${id}"

  init {
    id = View.generateViewId()
    orientation = VERTICAL
  }

  fun setPublicationUri(value: String) {
    if (publicationUri != value) {
      publicationUri = value
      scheduleOpen()
    }
  }

  fun setPublicationId(value: String) {
    publicationId = value
    scheduleOpen()
  }

  fun setDeclaredHrefs(value: List<String>) {
    declaredHrefs = value
    scheduleOpen()
  }

  fun setInitialLocator(value: Map<String, Any>?) {
    initialLocator = value
    scheduleOpen()
  }

  fun setPreferences(value: Map<String, Any>) {
    preferences = value
    navigator?.submitPreferences(makePreferences())
  }

  fun setContentInsets(value: Map<String, Double>) {
    setPadding(
      (value["left"] ?: 0.0).toInt(),
      (value["top"] ?: 0.0).toInt(),
      (value["right"] ?: 0.0).toInt(),
      (value["bottom"] ?: 0.0).toInt()
    )
  }

  fun goToLocator(value: Map<String, Any>): Boolean {
    val locator = Locator.fromJSON(JSONObject(value)) ?: return false
    return navigator?.go(locator) ?: false
  }

  fun goForward(): Boolean = navigator?.goForward() ?: false

  fun goBackward(): Boolean = navigator?.goBackward() ?: false

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    cleanup()
  }

  override fun onResourceLoadFailed(href: Url, error: ReadError) {
    onError(mapOf("code" to "resource_missing", "message" to error.toString(), "recoverable" to true, "href" to href.toString()))
  }

  override fun shouldFollowInternalLink(link: Link, context: HyperlinkNavigator.LinkContext?): Boolean {
    val event = mutableMapOf<String, Any>("href" to link.href.toString())
    link.title?.let { event["title"] = it }
    (context as? HyperlinkNavigator.FootnoteContext)?.let { event["content"] = it.noteContent }
    onLink(event)
    return false
  }

  override fun onExternalLinkActivated(url: AbsoluteUrl) {
    onLink(mapOf("href" to url.toString()))
  }

  private fun scheduleOpen() {
    openJob?.cancel()
    val uri = publicationUri ?: return
    if (publicationId.isNullOrEmpty() || declaredHrefs.isEmpty()) return
    val activity = appContext.currentActivity as? FragmentActivity ?: return
    openJob = activity.lifecycleScope.launch {
      kotlinx.coroutines.yield()
      try {
        val root = File(Uri.parse(uri).path ?: throw IllegalArgumentException("Invalid publication URI"))
        val entries = declaredHrefs.mapNotNull { Url.fromDecodedPath(it) }.toSet()
        val container = DirectoryContainer(root, entries)
        val httpClient = DefaultHttpClient()
        val retriever = org.readium.r2.shared.util.asset.AssetRetriever(context.contentResolver, httpClient)
        val opener = PublicationOpener(DefaultPublicationParser(context, httpClient, retriever, pdfFactory = null))
        val asset = retriever.retrieve(container, MediaType.EPUB).getOrElse { throw IllegalStateException(it.message) }
        val opened = opener.open(asset, allowUserInteraction = false).getOrElse { throw IllegalStateException(it.message) }
        install(activity, opened)
      } catch (error: Throwable) {
        onError(mapOf("code" to "open_failed", "message" to (error.message ?: error.toString()), "recoverable" to true))
      }
    }
  }

  private fun install(activity: FragmentActivity, opened: Publication) {
    cleanupInstalledNavigator(activity)
    publication = opened
    val initial = initialLocator?.let { Locator.fromJSON(JSONObject(it)) }
    activity.supportFragmentManager.fragmentFactory = EpubNavigatorFactory(opened).createFragmentFactory(
      initialLocator = initial,
      initialPreferences = makePreferences(),
      listener = this,
      configuration = EpubNavigatorFragment.Configuration(
        shouldApplyInsetsPadding = true,
        disablePageTurnsWhileScrolling = false
      )
    )
    activity.supportFragmentManager.commitNow {
      add(id, EpubNavigatorFragment::class.java, null, fragmentTag)
    }
    val fragment = activity.supportFragmentManager.findFragmentByTag(fragmentTag) as EpubNavigatorFragment
    navigator = fragment
    fragment.view?.layoutParams = LayoutParams(MATCH_PARENT, MATCH_PARENT)
    locatorJob = activity.lifecycleScope.launch {
      fragment.currentLocator.collectLatest { locator ->
        onLocatorChange(jsonObjectToMap(locator.toJSON()))
      }
    }
    onReady(emptyMap())
  }

  private fun makePreferences(): EpubPreferences = EpubPreferences(
    backgroundColor = color(preferences["backgroundColor"] as? String),
    fontSize = (preferences["fontSize"] as? Number)?.toDouble(),
    lineHeight = (preferences["lineHeight"] as? Number)?.toDouble(),
    pageMargins = (preferences["pageMargins"] as? Number)?.toDouble(),
    paragraphIndent = (preferences["paragraphIndent"] as? Number)?.toDouble(),
    scroll = preferences["mode"] == "scroll",
    textColor = color(preferences["textColor"] as? String),
    publisherStyles = false
  )

  private fun color(value: String?): Color? = value?.let {
    runCatching { Color(AndroidColor.parseColor(it)) }.getOrNull()
  }

  private fun jsonObjectToMap(value: JSONObject): Map<String, Any> = buildMap {
    val keys = value.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      when (val item = value.opt(key)) {
        null, JSONObject.NULL -> Unit
        is JSONObject -> put(key, jsonObjectToMap(item))
        is JSONArray -> put(key, jsonArrayToList(item))
        else -> put(key, item)
      }
    }
  }

  private fun jsonArrayToList(value: JSONArray): List<Any> = buildList {
    for (index in 0 until value.length()) {
      when (val item = value.opt(index)) {
        null, JSONObject.NULL -> Unit
        is JSONObject -> add(jsonObjectToMap(item))
        is JSONArray -> add(jsonArrayToList(item))
        else -> add(item)
      }
    }
  }

  private fun cleanupInstalledNavigator(activity: FragmentActivity?) {
    locatorJob?.cancel()
    locatorJob = null
    navigator?.let { fragment ->
      if (activity != null && fragment.isAdded) {
        activity.supportFragmentManager.commitNow(allowStateLoss = true) { remove(fragment) }
      }
    }
    navigator = null
    publication?.close()
    publication = null
  }

  private fun cleanup() {
    openJob?.cancel()
    openJob = null
    cleanupInstalledNavigator(appContext.currentActivity as? FragmentActivity)
  }
}
