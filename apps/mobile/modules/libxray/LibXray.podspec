Pod::Spec.new do |s|
  s.name = 'LibXray'
  s.version = '26.10.17'
  s.summary = 'Xray-core mobile runtime'
  s.homepage = 'https://github.com/XTLS/libXray'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.author = { 'XTLS' => 'https://github.com/XTLS' }
  s.platforms = { :ios => '16.4' }
  s.source = { :http => 'https://github.com/XTLS/libXray/releases/download/v26.10.17/libxray-apple-cgo.zip' }
  s.vendored_frameworks = 'LibXray.xcframework'
  s.static_framework = true
  s.requires_arc = true
  s.libraries = 'resolv.9'
  s.preserve_paths = 'LibXray.xcframework/**/*'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'BUILD_LIBRARY_FOR_DISTRIBUTION' => 'NO',
  }
end
