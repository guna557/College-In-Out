# College In-Out
 
A campus gate **IN/OUT logger** that scans student ID card barcodes and records when students enter or leave the college.
 
Built with **React + TypeScript + Vite**.
 
## Features
 
- Scan student ID cards (1D barcode) to log entry and exit
- Automatic IN/OUT logging with date and time
- Student lookup from a local student database (`students.json`)
- Fast, simple interface made for use at a gate counter
## Tech Stack
 
- React
- TypeScript
- Vite
- Barcode scanning (Dynamsoft / html5-qrcode)
## Getting Started
 
### Prerequisites
 
- [Node.js](https://nodejs.org/) (v18 or newer)
- npm
### Installation
 
```bash
git clone https://github.com/guna557/College-In-Out.git
cd College-In-Out
npm install
```
 
### Run in development
 
```bash
npm run dev
```
 
Then open the local URL shown in the terminal (usually `http://localhost:5173`).
 
### Build for production
 
```bash
npm run build
```
 
## Usage
 
1. Start the app.
2. Point the scanner or camera at the barcode on the student ID card.
3. The app finds the student and logs them as **IN** or **OUT**.
## Project Structure
 
```
College-In-Out/
├── src/            # App source code
├── public/         # Static files
├── package.json
└── README.md
```
 
## Roadmap
 
- [ ] Desktop app version
- [ ] Export logs to CSV / Excel
- [ ] Search and filter log history
## Author
 
**Vundavilli** — [@guna557](https://github.com/guna557)
