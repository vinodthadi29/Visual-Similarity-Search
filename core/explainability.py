import numpy as np
import tensorflow as tf
import cv2
import os
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, preprocess_input
from tensorflow.keras.preprocessing import image
from tensorflow.keras.models import Model

class GradCAMExplainer:
    def __init__(self):
        print("Loading XAI Explainer Model...")
        # We load the full model to intercept the class gradients
        self.model = MobileNetV2(weights='imagenet')
        
        # 'out_relu' is the final convolutional layer in MobileNetV2
        self.last_conv_layer_name = "out_relu"
        self.grad_model = Model(
            inputs=[self.model.inputs],
            outputs=[self.model.get_layer(self.last_conv_layer_name).output, self.model.output]
        )

    def generate_heatmap(self, img_path, save_path):
        """Generates a Grad-CAM heatmap and blends it with the original image."""
        # 1. Load and Preprocess the image
        img = image.load_img(img_path, target_size=(224, 224))
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        preprocessed_input = preprocess_input(img_array)

        # 2. Compute the Gradients
        with tf.GradientTape() as tape:
            last_conv_layer_output, preds = self.grad_model(preprocessed_input)
            pred_index = tf.argmax(preds[0]) # Get the dominant visual feature
            class_channel = preds[:, pred_index]

        # Calculate how important each feature map is to the final prediction
        grads = tape.gradient(class_channel, last_conv_layer_output)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

        # 3. Create the Heatmap
        last_conv_layer_output = last_conv_layer_output[0]
        heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        
        # Normalize between 0 and 1
        heatmap = tf.maximum(heatmap, 0) / tf.math.reduce_max(heatmap)
        heatmap = heatmap.numpy()

        # 4. Superimpose on the Original Image using OpenCV
        original_img = cv2.imread(img_path)
        if original_img is None:
            raise ValueError(f"Could not read image at {img_path}")
        
        # Resize heatmap to match the original high-res image
        heatmap_resized = cv2.resize(heatmap, (original_img.shape[1], original_img.shape[0]))
        heatmap_resized = np.uint8(255 * heatmap_resized)
        
        # Apply the 'JET' colormap (blue to red thermal look)
        heatmap_colormap = cv2.applyColorMap(heatmap_resized, cv2.COLORMAP_JET)
        
        # Blend the heatmap (40%) with the original image (60%)
        superimposed_img = cv2.addWeighted(original_img, 0.6, heatmap_colormap, 0.4, 0)
        
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        cv2.imwrite(save_path, superimposed_img)
        return save_path