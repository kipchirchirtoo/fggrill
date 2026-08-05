cmake_minimum_required(VERSION 3.14)
project(passkeys_windows_plugin LANGUAGES CXX)

set(PLUGIN_NAME "passkeys_windows_plugin")

add_library(${PLUGIN_NAME} SHARED
  "passkeys_windows_plugin.cpp"
)

apply_standard_cpp_compiler_flags(${PLUGIN_NAME})

target_compile_definitions(${PLUGIN_NAME} PRIVATE FLUTTER_PLUGIN_IMPL)

target_include_directories(${PLUGIN_NAME} INTERFACE
  "${CMAKE_CURRENT_SOURCE_DIR}/include"
)

target_link_libraries(${PLUGIN_NAME} PRIVATE flutter flutter_wrapper_plugin)
