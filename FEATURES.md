# Features & Documentation

## Navigation System

### Multiple Summary Types
The app now supports multiple summary types through a tabbed navigation system:

- **🎙️ Podcast Notes** - Summarize and organize podcast episodes
- **🍽️ Food Reviews** - Document and review dining experiences

### How to Use
- Navigate between summary types using the tabs in the navigation bar
- Each type maintains its own separate list and data
- Click **+ New** to create a new summary for the currently active type
- The navigation bar is sticky and always accessible

---

## Image Scanner (OCR)

### What It Does
The Image Scanner feature uses **Tesseract.js** to extract text from images in real-time. This is perfect for:

- Scanning handwritten notes from a notebook or whiteboard
- Extracting text from screenshots or photos
- Copying text from printed materials
- Converting image-based notes into editable text

### Supported Formats
- PNG, JPG, JPEG, GIF, WebP

### How to Use

#### Method 1: Click to Select
1. Go to the **New Summary** page
2. Click the **📸 Scan** tab at the top of the Notes section
3. Click the "Click to select" button
4. Choose an image file from your device
5. Wait for the OCR to process (you'll see progress)
6. Extracted text appears below

#### Method 2: Drag & Drop
1. Go to the **New Summary** page  
2. Click the **📸 Scan** tab
3. Drag an image file directly into the gray drop zone
4. Wait for processing to complete
5. Extracted text appears automatically

#### Method 3: Copy to Notes
1. After extracting text, click the **Copy** button to copy to clipboard
2. You can then paste it anywhere
3. Or switch back to the **✏️ Write** tab to see the text already added
4. Click **Clear** to remove the preview and start fresh

### Quality Tips
- Use well-lit, clear images for best results
- Avoid blurry or rotated images
- Text should be horizontal for best recognition
- Handwritten text is supported but may be less accurate than printed text
- The scanner works entirely in your browser - no data is sent to a server

### Technical Details
- **Library**: Tesseract.js v5 (JavaScript OCR engine)
- **Model**: English language model (configurable)
- **Processing**: Browser-based, privacy-focused
- **Speed**: ~5-30 seconds depending on image size and complexity

---

## Writing Mode

### Rich Text Editor
The **✏️ Write** tab provides a rich text editor with:

- **Bold, Italic, Underline** formatting
- **Lists** (ordered and unordered)
- **Headings** (multiple levels)
- **Blockquotes** for emphasis
- **Code blocks** for technical notes

### Tips
- Use headings to organize your summary structure
- Use blockquotes for key takeaways
- Use code blocks for technical terms or formulas
- Lists are great for action items or key points

---

## Process Logging

### Automatic Change Tracking
The project includes an automated process logging system that:

- Tracks all major modifications to the codebase
- Documents when features are added, fixed, or enhanced
- Records which components were changed
- Maintains a complete project history

### Process Log File
Located at: `PROCESS_LOG.md`

The log includes:
- Timestamp of each change
- Type of change (Feature, Fix, Enhancement, etc.)
- Component affected (Frontend, Backend, or Both)
- Files modified
- Description of the change

### Why This Matters
- Keep track of project evolution
- Document important milestones
- Reference what changed and when
- Useful for onboarding new team members

---

## Summary Form Fields

### Podcast Notes Specific
- **Podcast Name** (Required): The name of the podcast
- **Session Title** (Required): Episode title or number
- **Guest** (Optional): Guest speaker name(s)
- **Link** (Optional): URL to the episode
- **Notes** (Required): Your summary and thoughts

### Food Review Specific
- **Restaurant Name** (Required): Name of the restaurant/place
- **Dish Name** (Required): What you ordered/tried
- **Rating** (Optional): Your personal rating
- **Visit Date** (Optional): When you visited
- **Notes** (Required): Your review and experience

---

## Quick Start Guide

### Creating Your First Podcast Summary
1. Click **+ New** or navigate to the New Summary page
2. Fill in:
   - Podcast Name: "Huberman Lab"
   - Session Title: "Sleep & Adenosine"
   - Guest: "Dr. Matt Walker" (optional)
   - Link: podcast URL (optional)
3. Add your notes by either:
   - Typing directly in the **✏️ Write** tab
   - Using the **📸 Scan** tab to extract from an image
4. Click **Create Summary**

### Creating Your First Food Review
1. Switch to **🍽️ Food Reviews** using the navigation bar
2. Click **+ New**
3. Fill in your dining details
4. Add your review in the Notes section
5. Click **Create Summary**

---

## Keyboard Shortcuts

- **Ctrl/Cmd + S**: Save (when available)
- **Tab**: Navigate between form fields
- **Ctrl/Cmd + B**: Bold text (in rich editor)
- **Ctrl/Cmd + I**: Italic text (in rich editor)
- **Ctrl/Cmd + Z**: Undo (in rich editor)

---

## Troubleshooting

### OCR Not Working
- **Problem**: Image doesn't extract any text
  - **Solution**: Try a clearer, better-lit image. Handwritten text requires good penmanship.

- **Problem**: Takes too long to process
  - **Solution**: Reduce image size or crop to just the text area. Large images take longer to process.

- **Problem**: Text is jumbled or incorrect
  - **Solution**: Ensure image is straight and well-focused. Very small text or unusual fonts may not recognize well.

### Navigation Issues
- **Problem**: Switching tabs loses my work
  - **Solution**: All work is saved locally. The tab switch only changes what view you see, not your data.

- **Problem**: Can't find the create button
  - **Solution**: Look for the **+ New** button in the navigation bar (top right).

### Export & Sharing
- **Problem**: Can't export my summary
  - **Solution**: Use the export feature from the summary detail page or copy text manually.

---

## Future Enhancements

Planned features for upcoming releases:
- [ ] Multi-language OCR support
- [ ] Batch image processing
- [ ] Auto-formatting from scanned text
- [ ] Cloud storage integration
- [ ] Real-time collaboration
- [ ] AI-powered summary generation
- [ ] Custom categories and tags

---

## Support & Feedback

For issues, questions, or feature requests:
1. Check this documentation first
2. Review the PROCESS_LOG.md for recent changes
3. Open an issue on the project repository

---

Last Updated: 2026-08-23
