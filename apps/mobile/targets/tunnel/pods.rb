use_frameworks! :linkage => :static

pod 'LibXray',
    :path => File.expand_path('../../modules/libxray', __dir__),
    :modular_headers => true
