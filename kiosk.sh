#!/bin/bash

chromium-browser \
  --kiosk \
  --kiosk-printing \
  --disable-print-preview \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  http://localhost:3000