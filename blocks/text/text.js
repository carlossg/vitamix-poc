/**
 * Text Block
 *
 * Simple text content block with headline and body paragraphs.
 *
 * == DA/EDS Table Structure ==
 * Authored as a table with "Text" header row:
 *
 * | Text                                                    |
 * |---------------------------------------------------------|
 * | ## Headline                                             |
 * | First paragraph of body text.                           |
 * | Second paragraph with more content.                     |
 *
 * Single-column table, content flows naturally.
 *
 * HTML structure after EDS processing:
 * <div class="text">
 *   <div>                              <!-- single row -->
 *     <div>                            <!-- single cell -->
 *       <h2>Headline</h2>
 *       <p>First paragraph</p>
 *       <p>Second paragraph</p>
 *     </div>
 *   </div>
 * </div>
 */

// eslint-disable-next-line no-unused-vars -- text block needs no decoration
export default function decorate(block) {
  // Content is already properly structured from EDS
}
