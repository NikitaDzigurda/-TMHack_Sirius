import io
import random
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.report import DefectReport, ReportStatus
from app.services.s3 import s3_client

class SyntheticDataGenerator:
    """
    Generates synthetic defect images using image augmentation techniques.
    Uses Pillow to overlay defect patches onto base metro images.
    """
    
    CATEGORIES = ["seat", "handrail", "wall", "floor", "graffiti", "glass", "window"]
    STATIONS = ["Невский проспект", "Площадь Восстания", "Московская", "Технологический институт"]
    
    def generate_synthetic_image(self, category: str, width: int = 800, height: int = 600) -> bytes:
        """
        Generate a synthetic defect image for the given category.
        Creates a base image and applies random augmentations to simulate defects.
        """
        # Create base image with metro-like background
        img = Image.new('RGB', (width, height), color=self._get_base_color(category))
        draw = ImageDraw.Draw(img)
        
        # Add noise/texture
        for _ in range(random.randint(50, 150)):
            x = random.randint(0, width)
            y = random.randint(0, height)
            size = random.randint(1, 3)
            color = self._random_color_variation(img.getpixel((min(x, width-1), min(y, height-1))))
            draw.ellipse([x, y, x+size, y+size], fill=color)
        
        # Add category-specific defect
        self._add_defect(img, draw, category)
        
        # Apply random augmentations
        if random.random() > 0.5:
            img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.5, 1.5)))
        
        if random.random() > 0.5:
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(random.uniform(0.8, 1.2))
        
        # Convert to bytes
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG', quality=85)
        img_byte_arr.seek(0)
        return img_byte_arr.getvalue()
    
    def _get_base_color(self, category: str) -> tuple:
        """Get appropriate base color for category"""
        color_map = {
            "seat": (100, 120, 140),      # Grayish blue
            "handrail": (180, 180, 180),  # Light gray
            "wall": (220, 220, 210),      # Off-white
            "floor": (80, 80, 90),        # Dark gray
            "graffiti": (200, 200, 200),  # Light gray wall
            "glass": (240, 245, 250),     # Very light blue
            "window": (230, 235, 240),    # Light
        }
        return color_map.get(category, (150, 150, 150))
    
    def _random_color_variation(self, base_color: tuple, variance: int = 30) -> tuple:
        """Add random variation to a color"""
        return tuple(
            max(0, min(255, c + random.randint(-variance, variance)))
            for c in base_color
        )
    
    def _add_defect(self, img: Image, draw: ImageDraw, category: str):
        """Add category-specific defect to image"""
        width, height = img.size
        
        if category == "graffiti":
            # Draw random graffiti-like shapes
            for _ in range(random.randint(3, 8)):
                x = random.randint(0, width-100)
                y = random.randint(0, height-100)
                color = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
                draw.ellipse([x, y, x+random.randint(20, 80), y+random.randint(20, 80)], 
                           fill=color, outline=color)
        
        elif category == "seat":
            # Draw tear/damage
            x = random.randint(100, width-100)
            y = random.randint(100, height-100)
            draw.polygon([(x, y), (x+50, y+10), (x+40, y+50), (x-10, y+45)], 
                        fill=(40, 30, 30))
        
        elif category == "window" or category == "glass":
            # Draw crack pattern
            x_start, y_start = random.randint(0, width), random.randint(0, height)
            for _ in range(random.randint(5, 10)):
                x_end = x_start + random.randint(-100, 100)
                y_end = y_start + random.randint(-100, 100)
                draw.line([(x_start, y_start), (x_end, y_end)], fill=(50, 50, 50), width=2)
                x_start, y_start = x_end, y_end
        
        elif category == "floor":
            # Draw dirt/damage spots
            for _ in range(random.randint(5, 15)):
                x = random.randint(0, width)
                y = random.randint(0, height)
                size = random.randint(10, 40)
                draw.ellipse([x, y, x+size, y+size], fill=(30, 25, 20))
        
        else:
            # Generic damage
            x = random.randint(50, width-50)
            y = random.randint(50, height-50)
            draw.rectangle([x, y, x+60, y+40], fill=(100, 80, 70))
    
    async def generate_batch(self, db: AsyncSession, count: int = 100) -> list[DefectReport]:
        """
        Generate a batch of synthetic reports with images.
        """
        reports = []
        
        for i in range(count):
            category = random.choice(self.CATEGORIES)
            station = random.choice(self.STATIONS)
            
            # Generate synthetic image
            img_data = self.generate_synthetic_image(category)
            
            # Upload to MinIO
            filename = f"synthetic_{category}_{i}.jpg"
            object_name = s3_client.upload_file(img_data, filename, category)
            
            # Create database entry
            report = DefectReport(
                category=category,
                station=station,
                description=f"Synthetic {category} defect for training",
                latitude=59.9 + random.uniform(-0.1, 0.1),  # St. Petersburg coords
                longitude=30.3 + random.uniform(-0.1, 0.1),
                photo_url=object_name,
                is_synthetic=True,
                status=ReportStatus.COMPLETED,
                ai_result={
                    "confidence": random.uniform(0.85, 0.99),
                    "labels": [category, "synthetic"],
                    "generated": True
                }
            )
            db.add(report)
            reports.append(report)
            
            # Commit in batches
            if (i + 1) % 10 == 0:
                await db.flush()
        
        await db.commit()
        return reports

synthetic_generator = SyntheticDataGenerator()
