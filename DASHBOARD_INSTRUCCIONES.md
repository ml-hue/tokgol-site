# Cómo usar el componente `Dashboard`

Este repositorio incluye un componente React (`Dashboard.jsx`) que ya está corregido y listo para usarse en tu propio proyecto. Sigue estos pasos para copiarlo e integrarlo.

## 1) Copiar el archivo
1. Descarga o copia el contenido completo de `Dashboard.jsx`.
2. Coloca el archivo en tu proyecto React (por ejemplo en `src/` o donde prefieras organizar tus componentes).

## 2) Dependencias requeridas
- React 18 o superior.
- Dos clientes de Supabase:
  - `sb`: cliente autenticado interno.
  - `supabasePublic`: cliente de lectura para modo cliente.
- Los estilos globales que usa el componente viven en `index.css`. Copia también ese archivo o importa tus propios estilos equivalentes.

## 3) Cómo renderizarlo
```jsx
import Dashboard from "./Dashboard";

// Vista interna (usa `sb`)
<Dashboard />

// Vista pública para el cliente (usa `supabasePublic`)
<Dashboard clientMode token={"TOKEN_ENTREGADO_AL_CLIENTE"} />
```

## 4) Variables y tablas esperadas en Supabase
- Tabla `projects` con columnas `id`, `name`, `client_name`.
- Tabla `sessions` con columnas `id`, `project_id`, `title`, `date`, `tag`, `summary`, `client_responsible`, `client_status`.
- Tabla `project_phase` con columnas `project_name`, `current_phase`.
- Tabla `client_tokens` con columnas `token`, `project_name`, `client_name`, `expires_at`, `active`.

## 5) Notas útiles
- El componente selecciona automáticamente el primer proyecto disponible y muestra su bitácora.
- En modo cliente (`clientMode={true}`) valida el `token` y sólo muestra la información si el enlace está activo y no está vencido.
- Para compartir la vista pública desde la app interna, usa el botón "Compartir vista pública" que genera un token nuevo y copia el enlace al portapapeles.

¡Listo! Con estos pasos deberías poder copiar el código y usarlo en tu proyecto.
