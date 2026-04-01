import faiss
import numpy as np
import pickle
import os

class VectorStore:
    def __init__(self, dimension=1280, index_path="index_data/faiss_index.bin", paths_file="index_data/image_paths.pkl"):
        self.dimension = dimension
        self.index_path = index_path
        self.paths_file = paths_file
        self.image_paths = []
        
        # IndexFlatIP calculates the exact Inner Product (Dot Product)
        self.index = faiss.IndexFlatIP(self.dimension)
        self._load_index()

    def add_vector(self, vector, img_path):
        """Adds a single normalized vector to the FAISS index."""
        vector_np = np.array([vector]).astype('float32')
        self.index.add(vector_np)
        self.image_paths.append(img_path)

    def search(self, query_vector, k=5):
        """Searches the index for the top k most similar vectors."""
        if self.index.ntotal == 0:
            return []
            
        query_np = np.array([query_vector]).astype('float32')
        
        # Returns the similarity scores and the index IDs of the matches
        scores, indices = self.index.search(query_np, k)
        
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != -1 and idx < len(self.image_paths):
                results.append({
                    "image_path": self.image_paths[idx],
                    "similarity_score": float(scores[0][i])
                })
        return results

    def save_index(self):
        """Persists the FAISS index and the image paths to disk."""
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        faiss.write_index(self.index, self.index_path)
        with open(self.paths_file, 'wb') as f:
            pickle.dump(self.image_paths, f)

    def _load_index(self):
        """Loads the index from disk if it exists."""
        if os.path.exists(self.index_path) and os.path.exists(self.paths_file):
            self.index = faiss.read_index(self.index_path)
            with open(self.paths_file, 'rb') as f:
                self.image_paths = pickle.load(f)