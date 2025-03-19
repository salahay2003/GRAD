import numpy as np # type:ignore
import cv2 # type:ignore
from PIL import Image  # type:ignore
from tensorflow.keras.models import load_model # type: ignore
from sklearn.cluster import KMeans  # type:ignore
import random
from sklearn.mixture import GaussianMixture # type:ignore

# Load the pre-trained U2NET model
U2NET_MODEL = load_model('D:\Project\ImageRecoloring.h5', compile=False)

def preprocess_image(image, size):
    """Preprocess the image for the model."""
    img = image.convert('RGB')
    img = img.resize((size, size))
    img_array = np.array(img)
    return np.expand_dims(img_array, axis=0)

def apply_mask(image, mask):
    """Apply a binary mask to the image."""
    mask = (mask > 0.5).astype(np.uint8) * 255
    masked_image = cv2.bitwise_and(image, image, mask=mask)
    return masked_image

def monte_carlo_tree_search(base_colors, n_new_colors=3,existing_colors=None, n_iterations=2000, min_distance_threshold=3, random_state=0):
    if existing_colors is None:
        existing_colors = []
    # Fit Gaussian Mixture Model (GMM) on the base colors, setting the random state for reproducibility
    gmm = GaussianMixture(n_components=min(len(base_colors), 10), covariance_type='full', random_state=random_state).fit(base_colors)

    np.random.seed(random_state)  # Set the random seed for reproducibility

    best_new_colors = []
    for _ in range(n_new_colors):
        successful_sample = False
        for _ in range(n_iterations):
            # Sample a new color from the GMM
            new_color, _ = gmm.sample()
            new_color = new_color.flatten()
            new_color = np.clip(new_color, 0, 255)

            # Calculate distances
            distances = np.linalg.norm(base_colors - new_color, axis=1)
            min_distance = np.min(distances)

            if len(existing_colors) > 0:
                distances_existing = np.linalg.norm(existing_colors - new_color, axis=1)
                min_distance_existing = np.min(distances_existing)
            else:
                min_distance_existing = np.inf
            # Check if the new color is distinct enough from base colors
            if min_distance >= min_distance_threshold and min_distance_existing >= min_distance_threshold:
                best_new_colors.append(new_color)
                successful_sample = True
                break
        
        if not successful_sample:
         #   print("Warning: Could not find a valid new color within the distance threshold. Adjusting parameters.")
            # Generate a new color by slightly perturbing an existing base color
            perturbation = np.random.uniform(-20, 20, size=3)
            new_color = base_colors[np.random.choice(base_colors.shape[0])] + perturbation
            new_color = np.clip(new_color, 0, 255)
            best_new_colors.append(new_color)

    # Ensure no duplicate colors in the new colors
    best_new_colors = np.unique(np.round(best_new_colors).astype(int), axis=0)

    return np.array(best_new_colors)

def rgb_to_hex(rgb):
    """Convert RGB to HEX color."""
    return '#{:02x}{:02x}{:02x}'.format(rgb[0], rgb[1], rgb[2])

def plot_extended_palette(image, n_colors):
    """Generate and return an extended color palette from the image."""
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_rgb = np.array(image)
    pixels = image_rgb.reshape(-1, 3)
    mask = (pixels.sum(axis=1) != 0)
    pixels = pixels[mask]

    kmeans = KMeans(n_clusters=n_colors, n_init='auto', random_state=0).fit(pixels)
    colors = kmeans.cluster_centers_.astype(int)

   # new_colors = monte_carlo_tree_search(colors, n_new_colors=3, min_distance_threshold=3, random_state=0)
   # all_colors = np.vstack((colors, new_colors))

    return colors

def generate_multiple_palettes(image_path, num_palettes=5, n_colors=3, n_new_colors=3):
    """Generate multiple palettes from the same image and display them all at once."""
    all_palettes = []  # Store all palettes

    all_new_colors = []  # To keep track of all generated new colors
    # Step 1: Generate and save base palette
    base_colors = plot_extended_palette(image_path, n_colors=n_colors)  # Extract base colors

    for i in range(num_palettes):   
        
        # Step 2: Extend the palette, ensuring new colors are distinct across palettes
        new_colors = monte_carlo_tree_search(base_colors, n_new_colors=n_new_colors, existing_colors=np.array(all_new_colors), min_distance_threshold=3, random_state=i)

        if new_colors.shape[0] == 0:
            extended_colors = base_colors
        else:
            extended_colors = np.vstack((base_colors, new_colors))  # Combine base and new colors
            all_new_colors.extend(new_colors)  # Add new colors to the global list
        
        all_palettes.append(extended_colors)  # **Store the extended palette in the array**
    
    
   # """Convert each palette in the array from RGB to HEX."""
    hex_palettes = []
    for palette in all_palettes:
        hex_palette = [rgb_to_hex(color) for color in palette]
        hex_palettes.append(hex_palette)

    return hex_palettes