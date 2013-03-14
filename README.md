# todium-api

Adds a torrent to todium via an http interface
##Todo

/ and /tracker endpoints are identical. seperate these out.

##Usage
  curl -X POST 'http://api.todium.com'  \
      -d 'id=fb45906a3790fc5e85eab6251bcbd71b'  \
      -d 'secret=3d2d9b90932b3b2e424d5cbfa1173e02'  \
      -d 'src=http://www.clearbits.net/get/547-home-2009.torrent'
  
  __http://torrent.todium.com/-Ipf63TQ8PIhXXRNM5md.torrent__
  
  
  curl -X POST 'http://api.todium.com'  \
      -d 'id=fb45906a3790fc5e85eab6251bcbd71b'  \
      -d 'secret=3d2d9b90932b3b2e424d5cbfa1173e02'  \
      -d 'src=magnet:?xt=urn:btih:54DEC3E7B1169FAD5587D5A9E30FAFA92097EAB7&dn=Big+Buck+Bunny'
  
  __magnet:?xt=urn:btih:54DEC3E7B1169FAD5587D5A9E30FAFA92097EAB7&tr=http://tracker.todium.com/-Ipf7-4f0v_ThSId5rdg/announce__
  
  
  curl -X POST 'http://api.todium.com/tracker'  \
      -d 'id=fb45906a3790fc5e85eab6251bcbd71b'  \
      -d 'secret=3d2d9b90932b3b2e424d5cbfa1173e02'  \
      -d 'src=54DEC3E7B1169FAD5587D5A9E30FAFA92097EAB7'
  
  __http://tracker.todium.com/-Ipf7-4f0v_ThSId5rdg/announce__
  
  

## License
Copyright (c) 2013 Patrick Williams  
Licensed under the MIT license.
