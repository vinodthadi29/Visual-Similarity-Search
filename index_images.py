import os
import glob
from core.feature_extractor import FeatureExtractor
from core.vector_store import VectorStore

def build_index():
    print("Initializing models...")
    extractor = FeatureExtractor()
    vector_store = VectorStore()
    
    # Your exact Caltech-101 path
    dataset_base_path = os.path.join(os.getcwd(), "dataset", "gallery", "archive", "caltech-101")
    
    # Recursive globbing (**/*.jpg) digs into every category subfolder
    search_pattern = os.path.join(dataset_base_path, "**", "*.jpg")
    image_paths = glob.glob(search_pattern, recursive=True)
    
    if not image_paths:
        print(f"No images found in {dataset_base_path}. Please verify the path.")
        return

    print(f"Found {len(image_paths)} images across Caltech-101 categories. Starting extraction...")
    
    for i, img_path in enumerate(image_paths):
        try:
            # Extract the 1280-d feature vector
            vector = extractor.extract(img_path)
            
            # Store ONLY the relative path (e.g., "Motorbikes/image_0001.jpg")
            # This makes it much easier for Flask to serve the image later
            relative_path = os.path.relpath(img_path, dataset_base_path)
            
            vector_store.add_vector(vector, relative_path)
            
            if (i + 1) % 50 == 0:
                print(f"Processed {i + 1} / {len(image_paths)} images...")
        except Exception as e:
            print(f"Error processing {img_path}: {e}")

    vector_store.save_index()
    print("Indexing complete! Saved to index_data/faiss_index.bin")

if __name__ == "__main__":
    build_index()