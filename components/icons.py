import base64
from pathlib import Path

def svg_data_uri(path: str) -> str:
    """Convert SVG file to data URI for inline embedding"""
    svg_path = Path(path)
    if not svg_path.exists():
        return ""
    
    with open(svg_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/svg+xml;base64,{encoded}"

def render_icon(name: str, size: int = 18) -> str:
    """Render an SVG icon inline"""
    icon_path = f"static/icons/{name}.svg"
    uri = svg_data_uri(icon_path)
    
    if not uri:
        return ""
    
    return f'<img src="{uri}" class="ds-icon" style="width:{size}px; height:{size}px;" />'
