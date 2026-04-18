# Limpiar ejecuciones anteriores
rm -rf keys prescriptions
 
# 1. Registrar médico
echo ""
echo "--- [1] Registrar médico García ---"
python3 keygen.py --nombre garcia --rol medico
 
# 2. Registrar farmacéutico
echo ""
echo "--- [2] Registrar farmacéutico López ---"
python3 keygen.py --nombre lopez --rol farmaceutico
 
# 3. Médico crea y firma receta
echo ""
echo "--- [3] Médico crea receta para Juan Pérez ---"
python3 prescribe.py \
  --medico garcia \
  --paciente "Juan_Perez" \
  --medicamento "Amoxicilina" \
  --dosis "500mg" \
  --cantidad 21 \
  --instrucciones "1 cada 8 horas por 7 dias" \
  --privkey keys/medico_garcia_priv.pem
 
# 4. Ver la receta generada
echo ""
echo "--- [4] Contenido de la receta ---"
cat prescriptions/*.json
 
# 5. Farmacéutico verifica y sella
echo ""
echo "--- [5] Farmacéutico verifica y sella ---"
RECETA=$(ls prescriptions/*.json | head -1)
python3 dispense.py \
  --receta "$RECETA" \
  --pub_medico keys/medico_garcia_pub.pem \
  --priv_farm keys/farmaceutico_lopez_priv.pem \
  --farmaceutico lopez
 
# 6. Ver receta sellada
echo ""
echo "--- [6] Receta sellada ---"
cat "$RECETA"
