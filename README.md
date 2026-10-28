# Lucky Desk POS — Mobile Billing & Thermal Bluetooth Printing

A modern, mobile-first lottery and draw counter billing application built with **React 19**, **TypeScript**, **Vite**, **Supabase**, and native **ESC/POS Web Bluetooth Thermal Printer** support.

Designed specifically to run smoothly on smartphones (Android / iOS) and print receipts directly to 58mm & 80mm thermal Bluetooth printers without system print dialogs.

---

## 📱 Key Features

- **⚡ Direct Thermal Bluetooth Printing**:
  - Connects directly to mini Bluetooth thermal POS printers via the **Web Bluetooth API** (Android Chrome).
  - Generates binary **ESC/POS byte commands** (centering, double-height bold fonts, cut paper command).
  - Also supports **RawBT Android Driver Intent** and **58mm/80mm Browser Print CSS** fallbacks.
  - Dedicated **Print Test Receipt** tool in Settings.
- **📱 Phone-Optimized UI**:
  - Bottom navigation bar designed for one-thumb mobile operation.
  - Sticky live header with draw slot countdown and billing lock status.
  - Rapid number selector grid for **00–99** (2-digit) and **0–9** (1-digit) draws.
  - Quantity steppers with quick `+1`, `+5`, and `+10` buttons.
  - Draft persistence across switching cities and number types before finalizing a bill.
- **☁️ Supabase Cloud & Realtime Sync**:
  - Real-time updates across multiple counter phones (when one counter bills or admin declares a draw, all connected phones update automatically).
  - Seamless **Offline / LocalStorage fallback mode**: works immediately even without internet or before Supabase keys are configured!
- **🔒 Roles & Counter Accounts**:
  - **Admin View**: Declare results, configure draw timing intervals, set unit ticket prices, add/manage counter accounts, export JSON backups. Protected by PIN (default: `2468`).
  - **Counter View**: Restricted staff view showing only billing, their own sales, and receipt reprinting.
- **🏆 Live Draw Results & Prize Calculation**:
  - Admin declares winning numbers for any slot and city.
  - Automatically calculates winning bills, units, and counter-wise prize payouts with celebratory confetti animation.

---

## 🖨️ How Thermal Bluetooth Printing Works on Mobile

You can print using any of the 3 supported methods:

### Method 1: Web Bluetooth Direct (Recommended for Android Chrome)
1. Turn on your Bluetooth Thermal Printer (58mm or 80mm).
2. In the app header or in **Settings**, tap **"Connect BT"**.
3. Select your paired printer from the Chrome popup list.
4. When you tap **"Create & Print"**, raw ESC/POS commands are sent straight to the printer in under 0.5s!

### Method 2: RawBT App (Android Universal Standard)
1. Install the free **RawBT Print Service** from Google Play Store on your Android phone.
2. In app **Settings**, set Default Print Method to **"RawBT Driver (Android Intent)"**.
3. Every receipt sends an instant intent to RawBT for seamless printing to paired Bluetooth / USB printers.

### Method 3: Browser Print Dialog
- Formatted with `@media print` specifically for 58mm (48mm printable) and 80mm roll widths with high-contrast monospace typography.

---

## 🗄️ Supabase Setup (Database & Realtime)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Open `supabase_schema.sql` located in this project, copy all contents, paste into the Supabase SQL editor, and click **Run**.
4. Retrieve your **Project URL** and **Anon Public Key** from `Project Settings -> API`.
5. Enter them in the app under **Settings -> Supabase Cloud Database**, or set them in your `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

---

## 🚀 Deploying to Vercel

1. Push this folder to a GitHub repository.
2. In [Vercel](https://vercel.com), click **Add New -> Project** and import the repository.
3. Framework Preset will automatically detect **Vite**.
4. (Optional) Add your environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**! Your app will be live on HTTPS (required by Web Bluetooth API).

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev -- --host

# Build for production
npm run build
```

Open `http://localhost:5173/` or connect your phone to the same Wi-Fi and open `http://<your-computer-ip>:5173/`.
