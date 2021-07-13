import requests
import json
import logging
from datetime import datetime, timezone


class DataProxy:
    def __init__(self, litw_config):
        url_server = litw_config['url_server']
        url_auth = litw_config['url_auth']
        url_data = litw_config['url_data']
        url_data_params = litw_config['url_summary_params']
        self.summary_lifetime = litw_config['summary_lifetime']
        self.study_id = litw_config['study_id']
        self.study_key = litw_config['study_key']
        self.url_auth = url_server + url_auth
        self.url_data = url_server + url_data.format(self.study_id)
        self.url_summary = self.url_data + url_data_params.format('score', 'score;agent_coop_count')
        self.headers = {
            'Authorization': '',
            'content-type': 'application/json'
        }
        self.litw_token = None
        self.summary = {
            'timestamp_utc': 0,
            'data': {
                'total_rounds': 30,
                'average_score': 30,
                'average_coop': 10
            }
        }

    @staticmethod
    def get_utc_timestamp():
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        return int(now.timestamp())

    def _is_token_valid(self):
        if isinstance(self.litw_token, dict):
            if 'access_token' in self.litw_token and 'expiration' in self.litw_token:
                now = DataProxy.get_utc_timestamp()
                if (self.litw_token['expiration'] - now) > 10:
                    return True
        return False

    def _refresh_litw_token(self):
        response = requests.get(self.url_auth.format(self.study_id, self.study_key))
        if response.status_code == 200:
            try:
                self.litw_token = response.json()
                self.headers['Authorization'] = 'Bearer {}'.format(self.litw_token['access_token'])
            except Exception as e:
                logging.error('[LITW TOKEN]: {}'.format(e))
                self.litw_token = None
        else:
            logging.error('[LITW TOKEN]: Could not refresh token - {}'.format(response))
            self.litw_token = None

    def check_token(self):
        if not self._is_token_valid():
            self._refresh_litw_token()

    def save_data(self, study_data):
        self.check_token()
        response = requests.put(self.url_data, data=json.dumps(study_data), headers=self.headers)
        if response.status_code == 200:
            return True
        else:
            logging.error('[LITW SAVE]: {}'.format(response))
            return False

    def get_summary(self):
        timenow = DataProxy.get_utc_timestamp()
        if (timenow-self.summary['timestamp_utc']) > self.summary_lifetime:
            self.check_token()
            response = requests.get(self.url_summary, headers=self.headers)
            if response.status_code == 200:
                data = response.json()
                self.summary['timestamp_utc'] = timenow
                self.summary['data']['total_rounds'] = len(data)
                total_score = 0
                total_coop = 0
                for d in data:
                    total_score += d['data']['score'][0]
                    total_coop += (d['data']['agent_coop_count']['received']+d['data']['agent_coop_count']['provided'])
                self.summary['data']['average_score'] = int(total_score/len(data))
                self.summary['data']['average_coop'] = int(total_coop/len(data))
            else:
                logging.error('[LITW SUMMARY]: {}'.format(response))
        return self.summary
