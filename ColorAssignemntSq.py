import numpy as np # type:ignore

def calculate_color_distance(color1, color2):
    """Calculate the Euclidean distance between two RGB colors."""
    return np.linalg.norm(np.array(color1) - np.array(color2))

def relative_luminance(rgb):
    """Calculate the relative luminance of a color."""
    r, g, b = [x / 255.0 for x in rgb]
    r = r / 12.92 if r <= 0.03928 else ((r + 0.055) / 1.055) ** 2.4
    g = g / 12.92 if g <= 0.03928 else ((g + 0.055) / 1.055) ** 2.4
    b = b / 12.92 if b <= 0.03928 else ((b + 0.055) / 1.055) ** 2.4
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast_ratio(color1, color2):
    """Calculate the contrast ratio between two colors."""
    L1 = relative_luminance(color1)
    L2 = relative_luminance(color2)
    L1, L2 = max(L1, L2), min(L1, L2)
    return (L1 + 0.05) / (L2 + 0.05)

def find_background_color_single_palette(palette):
    """Select the background color with the lowest contrast against other colors."""
    background_candidates = []
    for i, extended_color in enumerate(palette):
        contrast_scores = [contrast_ratio(extended_color, other_color) for j, other_color in enumerate(palette) if i != j]
        avg_contrast = sum(contrast_scores) / len(contrast_scores)
        background_candidates.append((extended_color, avg_contrast))
    
    # Choose the color with the lowest average contrast
    return min(background_candidates, key=lambda x: x[1])[0]

def assign_palette_to_layers(layers, extended_palette):
    """Assign colors from the extended palette to layers, avoiding repetitions."""
    assignment = {}
    used_colors = set()  # Track used colors
    palette_length = len(extended_palette)

    # Find the background color using contrast
    background_color = find_background_color_single_palette(extended_palette)
    
    # Assign background color to the last layer (background layer)
    background_layer = layers[-1]  # The last layer is considered the background
    assignment[background_layer['name']] = background_color
    used_colors.add(tuple(background_color))  # Mark background color as used

    # Assign colors to the remaining layers
    for layer in layers[:-1]:  # Skip the background layer
        for color in extended_palette:
            if tuple(color) not in used_colors:
                assignment[layer['name']] = color
                used_colors.add(tuple(color))  # Mark color as used
                break

        # If all colors are used, you could reset used colors or handle differently if needed
        if len(used_colors) == palette_length:
            used_colors.clear()  # Uncomment this if you want to reuse colors once all are used

    return assignment