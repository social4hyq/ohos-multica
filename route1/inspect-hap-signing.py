import struct,sys,json
from pathlib import Path
for name in sys.argv[1:]:
 b=Path(name).read_bytes();e=b.rfind(b'PK\x05\x06');cd=struct.unpack_from('<I',b,e+16)[0]
 count,size,magic,version=struct.unpack_from('<IQ16sI',b,cd-32);base=cd-size
 out={'file':Path(name).name,'signature_version':version,'count':count,'magic':magic.decode(errors='replace'),'blocks':[]}
 for i in range(count):
  kind,length,offset=struct.unpack_from('<III',b,base+i*12);r={'id':hex(kind),'length':length}
  if kind==0x20000003:
   subid,sublen,suboff=struct.unpack_from('<III',b,base+offset);r['first_property_subblock']={'id':hex(subid),'length':sublen}
  out['blocks'].append(r)
 print(json.dumps(out,indent=2))
