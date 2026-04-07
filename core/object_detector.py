from ultralytics import YOLO

class ObjectDetector:
    def __init__(self):
        print("Loading YOLOv8n Engine...")
        # Automatically downloads the nano model (lightweight and very fast)
        self.model = YOLO('yolov8n.pt')

    def detect(self, img_path):
        """Runs YOLOv8 and returns bounding box coordinates for the UI."""
        results = self.model(img_path)
        boxes = []

        for result in results:
            img_h, img_w = result.orig_shape
            img_area = max(img_w * img_h, 1)

            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                label = self.model.names[cls]

                if conf > 0.25:
                    box_area = (x2 - x1) * (y2 - y1)
                    area_pct = round(box_area / img_area, 3)
                    boxes.append({
                        "x1": int(x1), "y1": int(y1),
                        "x2": int(x2), "y2": int(y2),
                        "label": label,
                        "confidence": round(conf, 3),
                        "area": area_pct
                    })

        boxes.sort(key=lambda b: b["confidence"], reverse=True)
        return boxes