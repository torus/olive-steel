start:
	./server &
	python -m SimpleHTTPServer

install:
	npm install
	./node_modules/.bin/bower install
