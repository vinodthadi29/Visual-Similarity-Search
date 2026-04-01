import numpy as np
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.preprocessing import image
from tensorflow.keras.models import Model

class FeatureExtractor:
    def __init__(self):
        # Load the pre-trained MobileNetV2 model
        base_model = MobileNetV2(weights='imagenet', include_top=True)
        
        # Extract features from the global average pooling layer (second-to-last layer)
        # This outputs a dense 1280-dimensional vector for each image
        self.model = Model(inputs=base_model.input, outputs=base_model.layers[-2].output)

    def extract(self, img_path):
        """
        Processes an image and returns a normalized 1280-d feature vector.
        """
        # MobileNetV2 requires strictly 224x224 pixel inputs
        img = image.load_img(img_path, target_size=(224, 224))
        img_array = image.img_to_array(img)
        expanded_img_array = np.expand_dims(img_array, axis=0)
        
        # Apply standard MobileNetV2 scaling (-1 to 1)
        preprocessed_img = preprocess_input(expanded_img_array)
        
        # Run inference to get the embedding
        features = self.model.predict(preprocessed_img)[0]
        
        # L2 Normalization: This is crucial for accurate similarity search
        normalized_features = features / np.linalg.norm(features)
        
        return normalized_features