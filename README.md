# SYS.DOCK // Dashboard

Una consola minimalista e industrial diseñada para monitorear contenedores Docker, auditar servicios de red del sistema host y buscar/asignar puertos libres. Construida con **React (Material UI 5)** en el frontend y **Flask (Python)** en el backend.

---

## ⚡ Características

* **Monitoreo y Control:** Visualización agrupada por proyectos de Docker Compose. Comandos en tiempo real para iniciar, detener, reiniciar e inspeccionar logs (`stdout`/`stderr`).
* **Auditoría de Servicios:** Escaneo paralelo y concurrente de puertos y servicios del host (SSH, bases de datos, paneles de control, etc.).
* **Matriz de Puertos:** Diagnóstico instantáneo de puertos libres y ocupados en el host, sugiriendo puertos disponibles para nuevos despliegues.
* **Tema Dinámico:** Soporte integrado para Modo Oscuro y Modo Claro con persistencia automática en el navegador (`localStorage`).
* **Despliegue Contenerizado:** Compilación y empaquetado optimizado mediante una construcción multi-etapa en Docker.

---

## 📁 Estructura del Repositorio

El repositorio está estructurado bajo el principio de separación de código fuente y artefactos de compilación:

```text
├── frontend/               # Código fuente del Frontend (React + Vite)
│   ├── src/                # Vistas, componentes y estilos
│   ├── index.html          # Punto de entrada HTML
│   ├── package.json        # Dependencias de Node.js
│   └── vite.config.js      # Configuración de empaquetado de Vite
├── app.py                  # API Backend (Flask + Docker SDK)
├── Dockerfile              # Construcción multi-etapa (NodeJS builder -> Python runner)
├── docker-compose.yml      # Definición y configuración de despliegue
├── requirements.txt        # Dependencias de Python (Flask, Docker, etc.)
├── .gitignore              # Configuración de exclusión para Git
└── external_services.json.example  # Plantilla de configuración de servicios host
```

> [!NOTE]
> Las carpetas `static/` y `templates/` no se versionan en Git. Para mantener el repositorio limpio y profesional, Docker compila y genera estos archivos dinámicamente durante el proceso de construcción de la imagen.

---

## 🚀 Instalación y Despliegue

### Requisitos Previos
* Docker y Docker Compose instalados.
* Permisos de lectura/escritura en el socket del daemon de Docker (`/var/run/docker.sock`).

### Paso 1: Configurar Servicios a Monitorear
Crea tu archivo de configuración local a partir de la plantilla:
```bash
cp external_services.json.example external_services.json
```
*(Edita `external_services.json` para añadir o eliminar los puertos y servicios del host que desees auditar).*

### Paso 2: Inicializar el Contenedor
Construye el frontend e inicia el backend en segundo plano:
```bash
docker compose up -d --build
```

### Paso 3: Acceder a la Consola
Abre tu navegador e ingresa a:
👉 **`http://localhost:8060`**

---

## 🛠️ Comandos de Mantenimiento

* **Detener la aplicación:**
  ```bash
  docker compose down
  ```
* **Ver logs del contenedor:**
  ```bash
  docker compose logs -f
  ```
* **Forzar recompilación tras modificar el código:**
  ```bash
  docker compose up -d --build --force-recreate
  ```

---

## 🔒 Seguridad

> [!IMPORTANT]
> Esta aplicación monta `/var/run/docker.sock` para interactuar con la API del motor de Docker. Esto le da acceso administrativo completo sobre tus contenedores. **Nunca expongas el puerto 8060 directamente a Internet**. Limita su uso a redes locales seguras (LAN) o a través de VPNs seguras (ej. Tailscale, WireGuard).
