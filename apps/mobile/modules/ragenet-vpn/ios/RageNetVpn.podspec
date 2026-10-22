Pod::Spec.new do |s|
  s.name = 'RageNetVpn'
  s.version = '0.1.25'
  s.summary = 'RageNet native VPN bridge'
  s.license = { :type => 'AGPL-3.0' }
  s.author = { 'RageNet' => 'https://github.com/syb1v/ragenet-app' }
  s.homepage = 'https://github.com/syb1v/ragenet-app'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => 'https://github.com/syb1v/ragenet-app.git', :tag => s.version.to_s }
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'NetworkExtension'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
