Pod::Spec.new do |s|
  s.name = 'NovellaPencil'
  s.version = '0.1.0'
  s.summary = 'Apple Pencil interaction bridge for Novella'
  s.description = 'Bridges the Apple Pencil double-tap gesture to the Novella mobile application.'
  s.license = { type: 'MIT' }
  s.author = { 'Novella' => 'dev@lightnovel.life' }
  s.homepage = 'https://github.com/celia-sh/Novella'
  s.source = { git: 'https://github.com/celia-sh/Novella.git' }
  s.platforms = { ios: '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
