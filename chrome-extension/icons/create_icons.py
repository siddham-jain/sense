# Create simple SVG icons and convert to PNG-like data URLs
# For a real extension, use proper PNG files

import base64

# Simple amber "S" logo as SVG
def create_icon_svg(size):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F5A623;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#E8854B;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" rx="{size//4}" fill="url(#grad)"/>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#111318" font-family="Arial Black, sans-serif" font-weight="900" font-size="{size*0.55}px">S</text>
</svg>'''

# Save as SVG files (Chrome can use them)
for size in [16, 48, 128]:
    svg = create_icon_svg(size)
    with open(f'icon{size}.svg', 'w') as f:
        f.write(svg)
    print(f'Created icon{size}.svg')

print('SVG icons created!')
