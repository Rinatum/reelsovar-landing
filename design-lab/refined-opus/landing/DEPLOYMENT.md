# Публикация v5

Адрес: https://rinatum.github.io/reelsovar-landing/

Исходный код и полный снимок находятся в ветке `feature/landing-motion-v5`. Готовая страница опубликована в ветке `gh-pages`, коммит `6e01ff354a82f419c00452cea456839c21032f2e`. Pages настроен на `gh-pages`, путь `/`, HTTPS включён. Ветка main и незакоммиченные изменения исходного проекта сохранены.

Развёртывание: https://github.com/Rinatum/reelsovar-landing/actions/runs/42098518079 — build и deploy завершились успешно.

Владелец явно подтвердил публичную загрузку кода и конкретного набора из 88 медиафайлов (91 393 920 байт), включая видео, аниме и стримы, и включение GitHub Pages. Точный набор с SHA-256 — publication-manifest.json.

## Следующее обновление

Из корня репозитория собрать снимок: `python3 design-lab/refined-opus/landing/scripts/build-pages.py`. Проверить сайт в `design-lab/refined-opus/landing/site/`. При изменении медиа сначала обновить контролируемый media-manifest.json.

Зафиксировать только файлы текущего кандидата в feature/landing-motion-v5, отправить эту ветку в origin. Затем из корня репозитория выполнить `git subtree push --prefix=design-lab/refined-opus/landing/site origin gh-pages`. Не включать посторонние dirty-изменения. Новая отправка gh-pages запускает Pages.

Проверка публикации из каталога кандидата: `LANDING_QA_URL=https://rinatum.github.io/reelsovar-landing/ node landing/qa/publication.mjs`. Дополнительно доступны rendered-video.mjs и behavior.mjs с тем же LANDING_QA_URL. Локальные snapshots остаются в игнорируемой shots/.

## Публикация v7, 06.11.2026

По разрешению владельца выкачена v7: исходники `c529ae1` в `feature/landing-motion-v5`, `gh-pages` → `2e4f5b5219539857cceb7cf3b731934413f43e12` (`git subtree push`, без force и без изменений main). Pages run 42192257291 — success. Опубликовано 75 медиафайлов, 34 047 393 байта (publication-manifest.json); новых файлов относительно разрешённого набора нет, убраны неиспользуемые полные ролики. Проверка публичного адреса: publication 12/12, rendered-video 49/49, 83/83 видеообластей движутся, чёрных нет.
