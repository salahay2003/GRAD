import numpy as np  # type:ignore
from itertools import combinations

def get_distance(palette, avg_color):
    palette = np.array(palette)
    avg_color = np.array(avg_color)
    return np.linalg.norm(palette - avg_color, axis=1)

def sort_by_distance(distances, reverse=True):
    return np.argsort(distances)[::-1] if reverse else np.argsort(distances)

def overlapping(layer1, layer2):
    # Placeholder implementation
    return True

def check_contrast(color1, color2, threshold=100):
    color1 = np.array(color1)
    color2 = np.array(color2)
    contrast = np.linalg.norm(color1 - color2)
    return contrast > threshold

def increase_contrast(color, contrast_factor=1.2):
    color = np.array(color)
    color = np.clip(color * contrast_factor, 0, 255).astype(int)
    return tuple(color)

def check_text_contrast(text_color, background_color, threshold=120):
    text_color = np.array(text_color)
    background_color = np.array(background_color)
    contrast = np.linalg.norm(text_color - background_color)
    return contrast > threshold

def adjust_text_contrast(text_color, background_color):
    if not check_text_contrast(text_color, background_color):
        # If contrast is too low, darken or lighten the text color
        text_color = np.array(text_color)
        avg_background = np.mean(background_color)
        if avg_background > 128:  # Background is light, darken the text
            text_color = np.clip(text_color * 0.7, 0, 255).astype(int)
        else:  # Background is dark, lighten the text
            text_color = np.clip(text_color * 1.3, 0, 255).astype(int)
        return tuple(text_color)
    return text_color

def assign_colors(palette, layers):
    try:
        # Convert to numpy array
        palette = np.array(palette)
        avg_color = np.mean(palette, axis=0).astype(int)
        
        # Get distances and sort
        color_distance_list = get_distance(palette, avg_color)
        palette_sorted_indices = sort_by_distance(color_distance_list, reverse=True)
        palette_sorted = [tuple(map(int, palette[i])) for i in palette_sorted_indices]  # Convert to native Python int
        print(palette_sorted)
        print(layers)
        
        # Assign colors to layers
        assignment = {}
        for index, layer in enumerate(layers):
            layer_name = layer['name']
            if index < len(palette_sorted):
                assignment[layer_name] = palette_sorted[index]
            else:
                assignment[layer_name] = palette_sorted[index % len(palette_sorted)]
        
        # Adjust contrast between layers
        for layer1, layer2 in combinations(assignment.keys(), 2):
            if overlapping(layer1, layer2):
                if not check_contrast(assignment[layer1], assignment[layer2]):
                    assignment[layer2] = increase_contrast(assignment[layer2])

        # Check and adjust text contrast
        for layer in layers:
            text_color = layer.get('text_color', (0, 0, 0))  # Default text color is black
            background_color = assignment[layer['name']]
            adjusted_text_color = adjust_text_contrast(text_color, background_color)
            assignment[layer['name']] = {
                'background_color': background_color,
                'text_color': adjusted_text_color
            }
        
        # Convert all colors to standard Python int
        assignment = {k: {'background_color': tuple(map(int, v['background_color'])),
                          'text_color': tuple(map(int, v['text_color']))} for k, v in assignment.items()}
        print(assignment)
        
        return assignment
    
    except Exception as e:
        print("Error in assign_colors:", str(e))
        raise
