Work only in this candidate directory. fonts/, vendor/, media/ are READ-ONLY shared symlinks. Never modify their targets. Do not modify original landing or sibling candidates. No git push, external publication, uploads, paid API, package installation or new agents. Existing dirty original is deliberately preserved. Use own browser tab and close only your tab. Preserve actual content and user-requested static mock controls. Write candidate-specific assets locally if needed.

## Обязательная проверка лендинга после правок

- Принятая реализация этого кандидата — вложенный `landing/`; «original landing» выше означает защищённые файлы в корне репозитория за пределами этого каталога. Сохраняй принятые структуру, дизайн и движение, если владелец не попросил их изменить.
- Перед правками HTML/CSS/JS/видео/анимаций `landing/` прочитай и примени локальный навык [landing-media-qa](tools/skills/landing-media-qa/SKILL.md). Он обязателен и для Codex, и для Claude; установка в глобальные настройки не требуется.
- После окончательной frontend-правки: измерить проблемное поведение, устранить подтверждённую причину, собрать `python3 landing/scripts/build-pages.py`, затем запустить **`node tools/qa/landing-media-gate.mjs`**. Правки только документации этого прогона не требуют.
- Не выдавай frontend-изменение за готовое, если gate завершился с ошибкой, обязательный сценарий пропущен либо проверена старая сборка. Сохрани отчёт и точную причину неполноты. После последующей правки frontend пересобери и повтори gate.
- Gate не заменяет просмотр пар кадров/мобильной композиции и замер изменённой анимации. Прогретый кеш, `paused=false`, `readyState`, Lighthouse и отсутствие JS-ошибок по отдельности не доказывают воспроизведение.
- Не перекладывай первичный QA на владельца. Эмуляцию не называй проверкой на настоящем телефоне; отзыв владельца привязывай только к проверенной им версии. Не списывай сбой на VPN без данных.

## Разрешение текущего релиза, 2026-11-08

Владелец явно поручил зафиксировать и залить принятую v8.1. Для этого релиза разрешены scoped commit и обычный push `feature/landing-motion-v5`, затем обновление существующей `gh-pages` сборкой из `landing/site/`. Это исключение из общего запрета публикации выше относится к текущему поручению. Не включать соседние варианты/посторонние dirty-файлы, не делать force push и не сливать всё в `main`.
