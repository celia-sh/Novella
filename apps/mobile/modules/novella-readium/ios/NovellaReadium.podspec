Pod::Spec.new do |s|
  s.name = 'NovellaReadium'
  s.version = '0.1.0'
  s.summary = 'Native Readium content renderer for Novella'
  s.description = 'Cross-platform native content renderer used by the Novella reader.'
  s.license = { type: 'MIT' }
  s.author = { 'Novella' => 'dev@lightnovel.life' }
  s.homepage = 'https://github.com/Kanscape/Novella'
  s.source = { git: 'https://github.com/Kanscape/Novella.git' }
  s.platforms = { ios: '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'ReadiumShared', '~> 3.11.0'
  s.dependency 'ReadiumStreamer', '~> 3.11.0'
  s.dependency 'ReadiumNavigator', '~> 3.11.0'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
