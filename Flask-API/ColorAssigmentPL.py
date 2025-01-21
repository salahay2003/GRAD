import numpy as np # type:ignore

def get_distance(color1, color2):
    """Calculate the Euclidean distance between two colors."""
    return np.linalg.norm(np.array(color1) - np.array(color2))

def calculate_average_color(layers):
    """Calculate the average color of the given layers."""
    total_color = np.zeros(3)
    for layer in layers:
        total_color += np.array(layer['color'])
    average_color = total_color / len(layers)
    return average_color.tolist()

def assign_colors_to_layers(layers, extended_palette):
    """Assign colors from the extended palette to layers based on distance."""
    assignments = {}

    # Loop through layers and assign the closest color from the extended palette
    for layer in layers:
        # Calculate the distance to each color in the extended palette
        distances = [get_distance(layer['color'], palette_color) for palette_color in extended_palette]
        closest_color = extended_palette[np.argmin(distances)]
        
        # Assign the closest color to the layer
        assignments[layer['name']] = closest_color

    return assignments
    return assignments