# Bot de Inteligencia Artificial (Gemini Live)

El proyecto cuenta con un sistema interactivo web conversacional integrado, situado estratégicamente en la parte superior de la navegación y siendo el punto de impacto inicial visual (Hero upper area).

Conecta directamente de forma nativa a los websockets neuronales de la API de Google Gemini ("Gemini 2.0 Flash Exp").

## Características Técnicas
- **Tecnología Core:** Funciona a través de la API `BidiGenerateContent` en websockets directamente con GenerativeLanguage API.
- **Interacción Exclusiva:** 100% Conversacional con entrada de Audio (PCM a 16kHz) y respuesta generada de forma multimodal en formato de audio nativo de vuelta (Voice name: "Aoede").
- **Flujo Visual:** Se implementó una respuesta sutil y visual tipo interfaz arcana (anillos giratorios / orbe resonante) para darle vida y personificación de acuerdo a la estética de Arcano. Cuando está conectado, el sistema palpita, cambia de un tono "Ámbar / Warning" durante el enrutado a conectividad directa, y por último se establece en "Turquesa / Teal" en status Activo / Connected.
- **El Prompt Principal del Bot:** *"Eres el experto en automatización de Arcano Solutions. Responde de forma amable, analítica y orientada a resultados."*

## Consideraciones de Setup
Para desarrollo o despliegue local que carezca de variables de entorno seguras, el sistema emite un Prompt Web que solicita al usuario introducir su clave temporal de validación de Google Gemini API, misma que es salvaguardada en LocalStorage para sesiones posteriores seguras bajo entorno host de pruebas.
