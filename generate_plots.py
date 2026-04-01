import os
import time
import pickle
import faiss
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.manifold import TSNE

# Set premium academic styling for the plots
sns.set_theme(style="whitegrid", palette="muted")
plt.rcParams.update({'font.size': 12, 'font.family': 'sans-serif'})

class PlotGenerator:
    def __init__(self, index_path="index_data/faiss_index.bin", paths_file="index_data/image_paths.pkl"):
        print("Loading FAISS Index and Metadata...")
        self.index = faiss.read_index(index_path)
        with open(paths_file, 'rb') as f:
            self.image_paths = pickle.load(f)
            
        # Reconstruct all vectors from FAISS
        self.vectors = np.array([self.index.reconstruct(i) for i in range(self.index.ntotal)])
        
        # Extract class labels from the folder names (e.g., "airplanes/img_01.jpg" -> "airplanes")
        self.labels = [os.path.dirname(path).split(os.sep)[-1] for path in self.image_paths]
        
        os.makedirs("plots", exist_ok=True)
        print(f"Loaded {len(self.vectors)} vectors across {len(set(self.labels))} categories.")

    def plot_tsne(self, top_n_classes=5):
        """Plot 1: t-SNE Clustering of MobileNetV2 Embeddings"""
        print("Generating t-SNE Cluster Plot (this may take a moment)...")
        
        # Filter to the top N most frequent classes for a cleaner plot
        class_counts = {label: self.labels.count(label) for label in set(self.labels)}
        top_classes = sorted(class_counts, key=class_counts.get, reverse=True)[:top_n_classes]
        
        indices = [i for i, label in enumerate(self.labels) if label in top_classes]
        filtered_vectors = self.vectors[indices]
        filtered_labels = [self.labels[i] for i in indices]
        
        # Compress 1280 dimensions to 2
        tsne = TSNE(n_components=2, random_state=42, perplexity=30)
        vectors_2d = tsne.fit_transform(filtered_vectors)
        
        plt.figure(figsize=(10, 8))
        sns.scatterplot(x=vectors_2d[:, 0], y=vectors_2d[:, 1], hue=filtered_labels, palette="tab10", s=60, alpha=0.8)
        plt.title(f"t-SNE Visualization of MobileNetV2 Embeddings (Top {top_n_classes} Classes)", fontweight='bold')
        plt.xlabel("t-SNE Dimension 1")
        plt.ylabel("t-SNE Dimension 2")
        plt.legend(title="Caltech-101 Category", bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout()
        plt.savefig("plots/1_tsne_clusters.png", dpi=300)
        plt.close()

    def plot_latency(self):
        """Plot 2: FAISS vs Linear Search Latency"""
        print("Simulating Search Latency...")
        sizes = [100, 500, 1000, 2000, min(5000, len(self.vectors))]
        faiss_times, linear_times = [], []
        
        query = self.vectors[0:1] # Use the first vector as a test query
        
        for size in sizes:
            subset_vectors = self.vectors[:size]
            
            # Linear Search (Numpy Dot Product)
            start = time.perf_counter()
            _ = np.dot(subset_vectors, query.T)
            linear_times.append((time.perf_counter() - start) * 1000)
            
            # FAISS Search
            temp_index = faiss.IndexFlatIP(1280)
            temp_index.add(subset_vectors)
            start = time.perf_counter()
            temp_index.search(query, 5)
            faiss_times.append((time.perf_counter() - start) * 1000)

        plt.figure(figsize=(8, 6))
        plt.plot(sizes, linear_times, marker='o', label='Linear Search (NumPy)', color='#ef4444', linewidth=2)
        plt.plot(sizes, faiss_times, marker='s', label='FAISS (Inner Product)', color='#10b981', linewidth=2)
        plt.title("Retrieval Latency: FAISS vs Linear Search", fontweight='bold')
        plt.xlabel("Number of Indexed Images")
        plt.ylabel("Query Time (milliseconds)")
        plt.legend()
        plt.tight_layout()
        plt.savefig("plots/2_search_latency.png", dpi=300)
        plt.close()

    def plot_similarity_distribution(self):
        """Plot 3: Cosine Similarity Distribution"""
        print("Calculating Similarity Distributions...")
        same_class_sims, diff_class_sims = [], []
        
        # Sample 1000 random pairs to build the distribution
        for _ in range(1000):
            i, j = np.random.randint(0, len(self.vectors), 2)
            sim = np.dot(self.vectors[i], self.vectors[j])
            
            if self.labels[i] == self.labels[j]:
                same_class_sims.append(sim)
            else:
                diff_class_sims.append(sim)

        plt.figure(figsize=(8, 6))
        sns.kdeplot(same_class_sims, fill=True, label="Same Category", color="#3b82f6")
        sns.kdeplot(diff_class_sims, fill=True, label="Different Category", color="#ef4444")
        plt.title("Cosine Similarity Score Distribution", fontweight='bold')
        plt.xlabel("Cosine Similarity Score")
        plt.ylabel("Density")
        plt.legend()
        plt.tight_layout()
        plt.savefig("plots/3_similarity_distribution.png", dpi=300)
        plt.close()

if __name__ == "__main__":
    generator = PlotGenerator()
    generator.plot_tsne()
    generator.plot_latency()
    generator.plot_similarity_distribution()
    print("\nSuccess! All academic plots have been saved to the 'plots/' directory.")