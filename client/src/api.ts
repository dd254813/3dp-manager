import axios from 'axios';

const api = axios.create({
  baseURL: `${location.protocol}//${location.hostname}:${location.port}/api`, 
});

export default api;