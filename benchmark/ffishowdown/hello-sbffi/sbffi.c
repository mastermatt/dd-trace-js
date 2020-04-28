#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <sys/_types/_size_t.h>
#define NAPI_VERSION 6
#include <node_api.h>
#include "../hello/hello.h"

void * buffer;
void * string_buffer;

napi_value SetBuffer(napi_env env, napi_callback_info info) {
  napi_status status;
  
  size_t argc = 1;
  napi_value args[1];
  status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  assert(status == napi_ok);

  size_t buffer_len;
  status = napi_get_buffer_info(env, args[0], &buffer, &buffer_len);
  assert(status == napi_ok);

  ((thinglist*)buffer)->things = buffer + sizeof(thinglist);

  napi_value result;
  status = napi_get_undefined(env, &result);
  assert(status == napi_ok);

  return result;
}

napi_value SetStringBuffer(napi_env env, napi_callback_info info) {
  napi_status status;
  
  size_t argc = 1;
  napi_value args[1];
  status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  assert(status == napi_ok);

  size_t buffer_len;
  status = napi_get_buffer_info(env, args[0], &string_buffer, &buffer_len);
  assert(status == napi_ok);

  napi_value result;
  status = napi_get_undefined(env, &result);
  assert(status == napi_ok);

  return result;
}

napi_value Hello(napi_env env, napi_callback_info info) {
  napi_status status;

  thinglist * tlist = buffer;

  size_t len = tlist->things_len;
  thing * things = tlist->things;
  size_t i = 0;
  while (i < len) {
    thing the_thing = things[i];
    the_thing.text = (const char *)((size_t)string_buffer + (size_t)the_thing.text);
    i++;
  }

  napi_value result;
  uint32_t sum = hello((thinglist*)buffer);
  status = napi_create_uint32(env, sum, &result);
  assert(status == napi_ok);

  return result;
}

#define DECLARE_NAPI_METHOD(name, func)                                        \
  { name, 0, func, 0, 0, 0, napi_default, 0 }

napi_value Init(napi_env env, napi_value exports) {
  napi_status status;
  napi_property_descriptor addDescriptor = DECLARE_NAPI_METHOD("hello", Hello);
  status = napi_define_properties(env, exports, 1, &addDescriptor);

  napi_property_descriptor addDescriptor2 = DECLARE_NAPI_METHOD("setBuffer", SetBuffer);
  status = napi_define_properties(env, exports, 1, &addDescriptor2);
  assert(status == napi_ok);

  napi_property_descriptor addDescriptor3 = DECLARE_NAPI_METHOD("setStringBuffer", SetStringBuffer);
  status = napi_define_properties(env, exports, 1, &addDescriptor3);
  assert(status == napi_ok);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)