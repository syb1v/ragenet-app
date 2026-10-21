use_frameworks! :linkage => :static

pod 'LibXray',
    :path => File.expand_path('../../vendor/libxray', __dir__),
    :modular_headers => true
