# Uzbek NER: API

## Запуск
0. Иметь запущенный API на устройстве
1. Склонировать репозиторий, например:
```
git clone https://github.com/uzbeki-vs-ner/ner-visualizer.git
cd ner-visualizer
```
2. Собрать контейнер и запустить его:
```
docker build -t ner-visualizer .
docker run --rm -p 8080:80 ner-visualizer
```
3. Смотреть на красивое по адресу `localhost:8080`
