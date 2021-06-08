#!/bin/bash
#EXAMPLE: docker run
# -v /var/log/data_litws/gunicorn/:/var/log/gunicorn/
# -v /etc/letsencrypt/:/etc/letsencrypt/
# -v /root/data_certs:/etc/certs
# -p 443:443 --detach litws:v1

if [[ -f $CERTS/file.key && -f $CERTS/file.crt ]] ; \
then gunicorn --workers=3 --certfile=$CERTS/file.crt --keyfile=$CERTS/file.key --bind=$HOST:443 \
--access-logfile=$LOG_ACCESS --log-file=$LOG_FILE app:app ; \
else gunicorn --workers=3 --bind=$HOST:80 --access-logfile=$LOG_ACCESS --log-file=$LOG_FILE app:app ; \
fi