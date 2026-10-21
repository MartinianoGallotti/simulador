# Simulador Formando Emprendedores

Web para practicar el certamen **Formando Emprendedores**: se dirige una empresa virtual durante varios períodos, con los mismos informes (Comentario Económico, Reporte de la Compañía, Reporte Industrial), la misma hoja de trabajo y el mismo cupón de 10 decisiones que en el certamen real, contra empresas bot o contra otros equipos en el mismo dispositivo.

## Qué tiene

- Motor fiel a las reglas del manual 2026 (planilla de costos, bancos, giro, préstamo adicional, penalidad, balance).
- Informes en formato certamen (monoespaciado, imprimible) y en vista moderna.
- Modo entrenamiento: avisos de errores frecuentes, "¿Qué pasó?", simulador "¿y si…?", gráficos, deshacer.
- Modo examen: hoja a mano, sin ayudas y con tiempo.
- Modo moderador: varios equipos por turnos, con los cupones ocultos.
- 3 escenarios (HOLTEC, recesión y calidad) y 6 personalidades de bot.

## Para desarrollar

Hace falta [Node.js](https://nodejs.org) 20 o más nuevo.

```bash
npm install
npm run dev      # abre la web en http://localhost:5173
npm test         # corre los tests del motor
npm run build    # arma la web estática en dist/
```

## Documentación

- `CLAUDE.md`: especificación completa del proyecto.
- `docs/supuestos.md`: todo lo que el material no confirma y cómo se resolvió.
- `docs/modelo-demanda.md`: el modelo de demanda y cómo recalibrarlo.

## Publicación

Cada vez que se suben cambios a la rama `main`, GitHub corre los tests y, si pasan, publica la web en GitHub Pages (ver `.github/workflows/publicar.yml`).
