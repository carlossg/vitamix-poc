# TV Mode for Vitamix POC

This document describes the TV mode feature that optimizes the Vitamix POC website for viewing on TV devices (Android TV, Google TV, Apple TV, etc.).

## Overview

TV Mode automatically detects when the site is being viewed on a TV device and applies optimizations:

- **Header shown** - Navigation and search remain accessible
- **No footer** - Maximizes content area by hiding footer
- **No scrolling** - Content fits within the viewport (100vh - header height)
- **Larger typography** - Scaled for viewing distance from TV
- **Optimized focus states** - Large, visible outlines for TV remote navigation
- **Full viewport layout** - Content uses entire screen space below header

## Key Features

✅ **Header Visible** - Navigation and search remain accessible  
✅ **No Footer** - Maximizes content area  
✅ **No Scrolling** - All content fits below header  
✅ **Larger Typography** - Readable from TV viewing distance  
✅ **Enhanced Focus** - Visible outlines for TV remote navigation  
✅ **Automatic Detection** - Works with user agent or URL param  
✅ **Android TV Integration** - Automatic in TV app  
✅ **All Page Types Supported** - Works with generated and authored pages  

## How It Works

### Detection Flow

1. **Page loads** → `loadPage()` runs first
2. **Check TV mode** → `isTVRequest()` checks:
   - User agent for TV keywords (tv, googletv, androidtv, appletv, webos, tizen, smarttv)
   - URL parameters (?tv=1 or ?tvmode=1)
3. **If TV detected**:
   - Apply `tv-mode` class to `<html>` and `<body>`
   - Load `tv-mode.css`
   - Set viewport to prevent zooming
   - Load header, skip footer

### Detection Methods

TV mode is automatically activated when:

1. **User Agent Detection**: The browser's user agent contains TV-related keywords:
   - `tv`
   - `googletv`
   - `androidtv`
   - `appletv`
   - `webos`
   - `tizen`
   - `smarttv`

2. **URL Parameter Override**: You can force TV mode by adding `?tv=1` or `?tvmode=1` to any URL

### Android TV App Integration

The Android TV app (`google-tv/`) automatically:
- Sets a custom user agent with "AndroidTV VitamixTV/1.0" identifier
- Adds `&tv=1` parameter to all URLs
- This ensures TV mode is always active in the Android TV app

```kotlin
// In DiscoveryActivity.kt
settings.userAgentString = "$defaultUserAgent AndroidTV VitamixTV/1.0"

val url = "${baseUrl}?cerebras=$encodedPrompt&tv=1"
```

### Visual Changes in TV Mode

**Before (Normal Mode):**
```
┌──────────────────────────┐
│ Header (64px)            │
├──────────────────────────┤
│                          │
│ Content (scrollable)     │
│                          │
│ ...more content...       │
│                          │
├──────────────────────────┤
│ Footer                   │
└──────────────────────────┘
```

**After (TV Mode):**
```
┌──────────────────────────┐
│ Header (64px) ← VISIBLE  │
├──────────────────────────┤
│                          │
│   Content (calc 100vh-   │
│   64px) No scrolling     │
│   Fills remaining space  │
│                          │
│                          │
└──────────────────────────┘
Footer hidden to maximize content
```

## Features

### Layout Optimizations

- **Header Visible**: Navigation remains accessible for TV remote control
- **Footer Hidden**: Removed to maximize content area
- **Full Viewport Height**: Content sections use `calc(100vh - 64px)` to fill screen below header
- **No Scrolling**: `overflow: hidden` prevents scrolling
- **Centered Content**: Content is centered and sized appropriately for TV viewing

### Typography Scaling

Font sizes are increased for comfortable viewing from TV distance:
- H1: `3.5rem` (56px)
- H2: `2.5rem` (40px)  
- H3: `2rem` (32px)
- Body text: `1.25rem` (20px)
- Buttons: `1.25rem` (20px) with larger padding

### Focus States

Enhanced focus indicators for TV remote navigation:
- 3px solid outline in brand red
- 4px outline offset
- Glowing shadow effect for visibility

### Content Adaptations

- Product cards: Grid layout optimized for TV screen
- Recipe cards: Larger images and text
- Forms: Larger inputs and buttons
- Images: Constrained to fit viewport without scrolling
- Loading states: Scaled up for visibility

## Implementation Details

### Core Functions (`scripts/scripts.js`)

**Added Functions:**
- `isTVRequest()` - Detects TV devices via user agent or URL parameter
- `applyTVMode()` - Applies TV-specific classes and viewport settings

**Modified Functions:**
- `loadPage()` - Checks for TV mode first, loads TV CSS, loads header but skips footer
- `loadLazy()` - Always loads header, skips footer in TV mode

### TV-Specific Styles (`styles/tv-mode.css`)

Comprehensive TV optimizations (370+ lines):
- Hide footer only (not header)
- Full viewport height calculations: `calc(100vh - var(--nav-height, 64px))`
- Typography scaled 1.5-2x for viewing distance
- Focus states enhanced for TV remote
- All content sections constrained to viewport
- Grid layouts optimized for TV screen dimensions

### Header Block (`blocks/header/header.js`)

- Header now always renders (removed TV mode check)
- Navigation and search accessible in TV mode

### Footer Block (`blocks/footer/footer.js`)

**Added:**
- `isTVMode()` function  
- Early return to skip rendering in TV mode

## File Structure

### Core Files

- **`styles/tv-mode.css`** - All TV-specific styles (370 lines)
- **`scripts/scripts.js`** - Detection logic (`isTVRequest()`, `applyTVMode()`)
- **`blocks/header/header.js`** - Header renders in TV mode
- **`blocks/footer/footer.js`** - Footer skips rendering in TV mode

### Android TV Integration

- **`google-tv/app/src/main/java/com/example/comparetv/ui/DiscoveryActivity.kt`**
  - Sets custom user agent
  - Adds `tv=1` parameter to URLs

## CSS Architecture

TV mode uses a class-based approach:

```css
/* Only hide footer, keep header visible */
body.tv-mode footer {
  display: none !important;
}

html.tv-mode,
body.tv-mode {
  height: 100vh;
  overflow: hidden;
}

/* Content accounts for header height */
body.tv-mode main {
  height: calc(100vh - var(--nav-height, 64px));
}
```

All TV-specific styles are prefixed with `body.tv-mode` to ensure they only apply in TV mode.

## CSS Selectors Used

All TV styles use these prefixes to scope correctly:

```css
body.tv-mode selector { ... }
html.tv-mode selector { ... }
```

This ensures styles only apply when TV mode is active.

## Supported Pages

TV mode works with all page types:

- ✅ Homepage with hero video
- ✅ Generated content pages (`?q=...`)
- ✅ Cerebras pages (`?cerebras=...`)
- ✅ Fast generation pages (`?fast=...`)
- ✅ Experiment pages (`?experiment=...`)
- ✅ Standard authored pages

## Usage

### Testing in Browser

1. **Use URL Parameter**:
   ```
   http://localhost:3000/?tv=1
   http://localhost:3000/?q=show+me+blenders&tv=1
   ```

2. **Simulate TV User Agent** (Chrome DevTools):
   - Open DevTools → Network conditions
   - Set custom user agent containing "AndroidTV"

### Android TV App

The app automatically enables TV mode - no configuration needed.

1. Build and install app on Android TV device
2. Launch app and perform voice search
3. Verify:
   - Header is visible with navigation
   - Footer is hidden
   - Content fills screen below header
   - No scrolling

### Browser Testing

```bash
# Start local server
aem up

# Test TV mode with URL parameter
open http://localhost:3000/?tv=1
open http://localhost:3000/?q=show+me+blenders&tv=1
```

## Development

### Adding New Blocks

When creating new blocks, consider TV mode:

1. Ensure content fits within `calc(100vh - 64px)` viewport height
2. Use relative sizing that works at larger scales
3. Test focus states for remote navigation
4. Avoid fixed positioning that might interfere

### Debugging

Enable TV mode in browser console:

```javascript
// Force enable TV mode
document.body.classList.add('tv-mode');
document.documentElement.classList.add('tv-mode');

// Check if TV mode is active
document.body.classList.contains('tv-mode');
```

## Testing Checklist

- [ ] Header is visible with navigation
- [ ] Footer is hidden
- [ ] Content fills viewport below header (no scrolling)
- [ ] Typography is readable from distance
- [ ] Focus states are visible with keyboard/remote
- [ ] Images are sized appropriately
- [ ] Buttons and interactive elements are easily targetable
- [ ] Loading states are visible
- [ ] Generated content renders properly
- [ ] Search bar in header works with TV remote

## Browser Support

TV mode is tested on:
- ✅ Android TV (WebView)
- ✅ Google TV
- ✅ Chrome browser (simulated)
- ⚠️ Apple TV (untested, but should work with user agent detection)
- ⚠️ Smart TVs (LG WebOS, Samsung Tizen - untested)

## Compatibility

**Tested:**
- ✅ Chrome browser with `?tv=1` parameter
- ✅ Android TV WebView

**Should Work (Untested):**
- Apple TV
- Samsung Tizen Smart TVs
- LG WebOS TVs
- Any device with TV user agent

## Known Limitations

1. **Multi-page Content**: Content that would normally scroll is currently truncated. Consider pagination for long content.

2. **No Scroll Alternative**: Currently relies on content fitting in viewport. Future: Add swipe/paginate with remote.

3. **Modals/Overlays**: May need additional styling for TV remote navigation.

4. **Forms**: Input methods on TV (virtual keyboard) may need UX refinement.

5. **Video Playback**: Background videos work, but interactive video controls should be tested.

## Future Enhancements

- [ ] Content pagination for multi-page layouts
- [ ] TV remote directional navigation (D-pad) event handling
- [ ] Voice input integration
- [ ] Analytics tracking for TV usage patterns
- [ ] A/B testing of TV-specific layouts
- [ ] Accessibility improvements for TV platforms
- [ ] TV-specific block variants

## Files Changed

```
Modified:
  scripts/scripts.js                                  (+45 lines)
  blocks/header/header.js                             (removed TV check)
  blocks/footer/footer.js                             (+8 lines)
  google-tv/app/.../DiscoveryActivity.kt              (+5 lines)

Created:
  styles/tv-mode.css                                  (370 lines)
  TV-MODE.md                                          (this file)
```

## Performance Impact

- **Minimal**: Only loads additional CSS (~15KB) when TV detected
- **No JS overhead**: Simple class addition
- **Faster rendering**: Skips footer decoration (header still loads)

## Accessibility

TV mode includes enhanced focus indicators that also benefit keyboard navigation on desktop. Consider this a progressive enhancement that improves accessibility across all platforms.

## Rollback

To disable TV mode completely:

1. Remove `tv-mode.css` import from `scripts.js`
2. Remove `isTVRequest()` and `applyTVMode()` calls
3. Revert footer.js changes

Or simply don't pass `?tv=1` parameter (user agent detection can be disabled by commenting out detection logic).

## Support

For issues or questions about TV mode:
1. Check browser console for "[TV Mode]" log messages
2. Verify user agent includes TV identifier
3. Test with `?tv=1` parameter to rule out detection issues
4. Check `styles/tv-mode.css` is loaded in network tab
