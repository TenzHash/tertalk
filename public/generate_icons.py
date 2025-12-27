from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_gradient_icon(size, filename):
    # 1. Setup Colors (Indigo to Violet)
    start_color = (99, 102, 241)  # #6366f1
    end_color = (139, 92, 246)    # #8b5cf6
    
    # 2. Create Base Image
    img = Image.new('RGB', (size, size), start_color)
    draw = ImageDraw.Draw(img)
    
    # 3. Draw Gradient (Diagonal)
    for y in range(size):
        for x in range(size):
            # Calculate distance from top-left to bottom-right for gradient
            p = (x + y) / (size * 2)
            r = int(start_color[0] + (end_color[0] - start_color[0]) * p)
            g = int(start_color[1] + (end_color[1] - start_color[1]) * p)
            b = int(start_color[2] + (end_color[2] - start_color[2]) * p)
            draw.point((x, y), fill=(r, g, b))

    # 4. Draw the "T" Logo
    # Try to load a font, fallback to default if not found
    try:
        # Tries to find a clean sans-serif font on your system
        font_path = "arial.ttf" 
        font = ImageFont.truetype(font_path, int(size * 0.6))
    except IOError:
        font = ImageFont.load_default()

    text = "T"
    
    # Calculate text size using standard bbox
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    text_width = right - left
    text_height = bottom - top
    
    # Center position
    position = ((size - text_width) / 2 - left, (size - text_height) / 2 - top - (size * 0.05))
    
    # Draw simple text shadow
    shadow_offset = int(size * 0.02)
    draw.text((position[0] + shadow_offset, position[1] + shadow_offset), text, font=font, fill=(0, 0, 0, 50))
    
    # Draw white text
    draw.text(position, text, font=font, fill=(255, 255, 255))

    # 5. Save
    img.save(filename)
    print(f"✅ Generated {filename}")

# Generate both sizes
create_gradient_icon(192, "icon-192.png")
create_gradient_icon(512, "icon-512.png")