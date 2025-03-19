import cv2
import numpy as np

def get_lab_values_from_color(color):
    """
    Convert an RGB color to CIELAB and return the a* and b* values.
    """
    color_bgr = np.uint8([[color[::-1]]])  # Reversing RGB to BGR
    color_lab = cv2.cvtColor(color_bgr, cv2.COLOR_BGR2LAB)
    _, a_channel, b_channel = cv2.split(color_lab)
    a = a_channel[0, 0]
    b = b_channel[0, 0]
    return a, b

def apply_dominant_color(image_rgb, target_color, scale_factor=1.0):
    """
    Apply a dominant color to the image based on the target color.
    """
    # Convert RGB to CIELAB
    image_lab = cv2.cvtColor(image_rgb, cv2.COLOR_BGR2LAB)

    # Split LAB image into channels
    L, A, B = cv2.split(image_lab)

    # Get a* and b* values from the target color
    target_a, target_b = get_lab_values_from_color(target_color)
    
    # Calculate the adjustments needed for each channel
    mean_a = A.mean()
    mean_b = B.mean()
    
    adjustment_a = (target_a - mean_a) * scale_factor
    adjustment_b = (target_b - mean_b) * scale_factor

    # Apply the adjustments
    A = cv2.add(A, adjustment_a)
    B = cv2.add(B, adjustment_b)

    # Clip the values to be within valid range [0, 255]
    A = np.clip(A, 0, 255).astype(np.uint8)
    B = np.clip(B, 0, 255).astype(np.uint8)
    L = L.astype(np.uint8)
    
 # Merge channels and convert back to RGB
    image_lab_modified = cv2.merge([L, A, B])
    image_rgb_modified = cv2.cvtColor(image_lab_modified, cv2.COLOR_LAB2BGR)
    
    return image_rgb_modified