#import <CoreText/CoreText.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

/// iOS has no italic face for PingFang and, unlike browsers, never slants a
/// font that lacks one. React Native lays an italic run out in the system
/// italic font, and the Chinese characters in it fall back to upright
/// PingFang, so `<i>` and `*斜体*` show no italic at all in Chinese.
///
/// TextKit swaps in the fallback font as soon as a text storage is created
/// from an attributed string, so this hooks that initializer: inside a run
/// whose font is italic, every character the font itself cannot draw gets
/// the oblique slant WebKit synthesizes (14°). Latin text keeps its real
/// italic glyphs.
static const CGFloat NovellaSyntheticObliqueness = 0.2493; // tan(14°)

typedef id (*NovellaInitWithAttributedStringIMP)(id, SEL, NSAttributedString *);
static NovellaInitWithAttributedStringIMP NovellaOriginalInitWithAttributedString;

static NSAttributedString *NovellaSlantItalicFallback(NSAttributedString *string);

static id NovellaInitWithAttributedString(id self, SEL command, NSAttributedString *string)
{
  return NovellaOriginalInitWithAttributedString(self, command, NovellaSlantItalicFallback(string));
}

@interface NovellaItalicFallbackOblique : NSObject
@end

@implementation NovellaItalicFallbackOblique

+ (void)load
{
  // NSTextStorage is a class cluster; hook the class it actually allocates.
  Class storageClass = [[NSTextStorage alloc] init].class;
  SEL selector = @selector(initWithAttributedString:);
  Method method = class_getInstanceMethod(storageClass, selector);
  if (method == NULL) {
    return;
  }
  NovellaOriginalInitWithAttributedString = (NovellaInitWithAttributedStringIMP)method_getImplementation(method);
  // Replacing on the concrete class overrides an inherited implementation
  // without touching NSTextStorage's own.
  class_replaceMethod(
    storageClass,
    selector,
    (IMP)NovellaInitWithAttributedString,
    method_getTypeEncoding(method)
  );
}

@end

static BOOL NovellaFontDrawsCharacters(UIFont *font, NSString *text, NSRange range)
{
  UniChar characters[range.length];
  CGGlyph glyphs[range.length];
  [text getCharacters:characters range:range];
  return CTFontGetGlyphsForCharacters((__bridge CTFontRef)font, characters, glyphs, (CFIndex)range.length);
}

static NSAttributedString *NovellaSlantItalicFallback(NSAttributedString *string)
{
  if (string.length == 0) {
    return string;
  }
  NSString *text = string.string;
  __block NSMutableAttributedString *slanted = nil;
  [string enumerateAttribute:NSFontAttributeName
                     inRange:NSMakeRange(0, string.length)
                     options:0
                  usingBlock:^(UIFont *font, NSRange fontRange, __unused BOOL *stop) {
    if (![font isKindOfClass:[UIFont class]] ||
        (font.fontDescriptor.symbolicTraits & UIFontDescriptorTraitItalic) == 0) {
      return;
    }
    [text enumerateSubstringsInRange:fontRange
                             options:NSStringEnumerationByComposedCharacterSequences |
                                     NSStringEnumerationSubstringNotRequired
                          usingBlock:^(__unused NSString *substring,
                                       NSRange characterRange,
                                       __unused NSRange enclosingRange,
                                       __unused BOOL *innerStop) {
      if (NovellaFontDrawsCharacters(font, text, characterRange) ||
          [string attribute:NSObliquenessAttributeName atIndex:characterRange.location effectiveRange:NULL] != nil) {
        return;
      }
      if (slanted == nil) {
        slanted = [string mutableCopy];
      }
      [slanted addAttribute:NSObliquenessAttributeName value:@(NovellaSyntheticObliqueness) range:characterRange];
    }];
  }];
  return slanted ?: string;
}
