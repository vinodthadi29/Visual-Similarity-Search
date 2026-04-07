import numpy as np
import cv2
import os


def color_histogram_similarity(img1_path, img2_path):
    img1 = cv2.imread(img1_path)
    img2 = cv2.imread(img2_path)
    if img1 is None or img2 is None:
        return 0.5
    hsv1 = cv2.cvtColor(img1, cv2.COLOR_BGR2HSV)
    hsv2 = cv2.cvtColor(img2, cv2.COLOR_BGR2HSV)
    h_bins, s_bins = 50, 60
    ranges = [0, 180, 0, 256]
    hist1 = cv2.calcHist([hsv1], [0, 1], None, [h_bins, s_bins], ranges)
    hist2 = cv2.calcHist([hsv2], [0, 1], None, [h_bins, s_bins], ranges)
    cv2.normalize(hist1, hist1, 0, 1, cv2.NORM_MINMAX)
    cv2.normalize(hist2, hist2, 0, 1, cv2.NORM_MINMAX)
    score = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
    return max(0.0, float(score))


def texture_similarity(img1_path, img2_path):
    img1 = cv2.imread(img1_path, cv2.IMREAD_GRAYSCALE)
    img2 = cv2.imread(img2_path, cv2.IMREAD_GRAYSCALE)
    if img1 is None or img2 is None:
        return 0.5
    v1 = cv2.Laplacian(img1, cv2.CV_64F).var()
    v2 = cv2.Laplacian(img2, cv2.CV_64F).var()
    if max(v1, v2) == 0:
        return 1.0
    return float(min(v1, v2) / max(v1, v2))


def hybrid_score(feature_sim, color_sim, texture_sim, weights=(0.65, 0.25, 0.10)):
    return (weights[0] * feature_sim + weights[1] * color_sim + weights[2] * texture_sim)


def reduce_to_3d(vectors):
    from sklearn.decomposition import PCA
    vectors = np.array(vectors, dtype='float32')
    n = len(vectors)
    if n < 2:
        return [[0.0, 0.0, 0.0]] * n
    n_components = min(3, n - 1) if n <= 3 else 3
    pca = PCA(n_components=n_components)
    reduced = pca.fit_transform(vectors)
    if reduced.shape[1] < 3:
        pad = np.zeros((n, 3 - reduced.shape[1]))
        reduced = np.hstack([reduced, pad])
    reduced = reduced / (np.abs(reduced).max() + 1e-8)
    return reduced.tolist()
