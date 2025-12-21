#!/bin/bash
# Script para ejecutar la migración en Azure

# Subir el script al App Service
az webapp deploy --resource-group evaluaasi-motorv2-rg --name evaluaasi-motorv2-api --src-path add_image_column.py --type static --target-path /home/site/wwwroot/add_image_column.py

# Ejecutar el script
az webapp ssh --resource-group evaluaasi-motorv2-rg --name evaluaasi-motorv2-api <<'EOFCMD'
cd /home/site/wwwroot
python add_image_column.py
exit
EOFCMD
