UPDATE area
SET activo = false
WHERE padre_id IS NULL
  AND nombre IN (
    'Microred Boca Colorado',
    'Microred Huepetuhe',
    'Microred Iberia',
    'Microred Jorge Chávez',
    'Microred Laberinto',
    'Microred Mazuko',
    'Microred Nuevo Milenio',
    'Microred Planchón',
    'Microred Salvación',
    'Establecimientos sin microred'
  )
  AND NOT EXISTS (SELECT 1 FROM vinculo WHERE vinculo.area_id = area.id);
