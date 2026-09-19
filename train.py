import glob
import os
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler
import joblib

# 1. Gather all 189 nested Excel files (ignoring Excel lock files ~$...)
folder_path = "data/train_data"
all_files = glob.glob(os.path.join(folder_path, "**", "*.xlsx"), recursive=True)
excel_files = [f for f in all_files if not os.path.basename(f).startswith("~$")]

print(f"Found {len(excel_files)} valid Excel files. Reading datasets...")

# 2. Read all files safely into a list of DataFrames
df_list = []
for file in excel_files:
    try:
        df = pd.read_excel(file, engine="openpyxl")
        df_list.append(df)
    except Exception as e:
        print(f"Skipping file {file} due to error: {e}")

full_df = pd.concat(df_list, ignore_index=True)
print(f"Total dataset rows loaded: {len(full_df)}")

# 3. Extract target feature columns and handle missing data
feature_cols = ["temperature_2m", "relative_humidity_2m", "surface_pressure"]

for col in feature_cols:
    full_df[col] = pd.to_numeric(full_df[col], errors='coerce')

for col in feature_cols:
    median_val = full_df[col].median()
    fill_val = median_val if pd.notna(median_val) else 0.0
    full_df[col] = full_df[col].fillna(fill_val)

full_df = full_df.dropna(subset=feature_cols)
X_raw = full_df[feature_cols].values

# 4. Scale features using StandardScaler
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_raw)

# Save the scaler object using joblib
joblib.dump(scaler, "scaler.pkl")
print("Saved feature scaler to 'scaler.pkl'")

# 5. Prepare PyTorch DataLoader
X_tensor = torch.tensor(X_scaled, dtype=torch.float32)
dataset = TensorDataset(X_tensor, X_tensor)
train_loader = DataLoader(dataset, batch_size=64, shuffle=True)

# 6. Define the Weather Autoencoder Network
class WeatherAutoencoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(3, 2),
            nn.ReLU()
        )
        self.decoder = nn.Sequential(
            nn.Linear(2, 3)
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))

model = WeatherAutoencoder()
criterion = nn.MSELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

# 7. Train the Neural Network
epochs = 10
print("\nStarting Autoencoder training...")

for epoch in range(epochs):
    total_loss = 0.0
    for batch_x, _ in train_loader:
        optimizer.zero_grad()
        outputs = model(batch_x)
        loss = criterion(outputs, batch_x)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    
    avg_loss = total_loss / len(train_loader)
    print(f"Epoch [{epoch+1}/{epochs}], Loss: {avg_loss:.4f}")

# 8. Save trained model weights
torch.save(model.state_dict(), "weather_autoencoder.pth")
print("\nTraining complete!")
print("Saved model weights to 'weather_autoencoder.pth'")
print("Saved scaler object to 'scaler.pkl'")