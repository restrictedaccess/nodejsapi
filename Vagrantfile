Vagrant.configure("2") do |config|
  config.vm.box = "debian/wheezy64"

  #config.vm.forward_port 3000, 3000
  config.vm.network "private_network", ip: "192.168.122.50"
  #config.vm.share_folder "app", "/home/vagrant/app", "app"
  config.vm.synced_folder "app/", "/home/vagrant/app", nfs:true

  # Uncomment the following line to allow for symlinks
  # in the app folder. This will not work on Windows, and will
  # not work with Vagrant providers other than VirtualBox
  # config.vm.customize ["setextradata", :id, "VBoxInternal2/SharedFoldersEnableSymlinksCreate/app", "1"]
  config.vm.provision :shell, path: "bootstrap.sh"
end
