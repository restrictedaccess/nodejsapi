#!/usr/bin/env bash
debconf-set-selections <<< 'mysql-server mysql-server/root_password password kamote888kamote999kamote000'
debconf-set-selections <<< 'mysql-server mysql-server/root_password_again password kamote888kamote999kamote000'
apt-get update
apt-get install -y curl
apt-get install -y mysql-server

if [ ! -f /var/log/databasesetup ];
then
    echo "CREATE DATABASE remotestaff" | mysql -uroot -pkamote888kamote999kamote000
    echo "CREATE USER 'remotestaff'@'localhost' IDENTIFIED BY 'i0MpD3k6yqTz'" | mysql -uroot -pkamote888kamote999kamote000
    echo "GRANT SELECT,UPDATE,DELETE,INSERT ON remotestaff.* TO 'remotestaff'@'localhost'" | mysql -uroot -pkamote888kamote999kamote000
    echo "flush privileges" | mysql -uroot -pkamote888kamote999kamote000
fi

apt-get install -y vim
apt-get install -y curl
apt-get install software-properties-common -y
add-apt-repository ppa:couchdb/stable -y
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 0C49F3730359A14518585931BC711F9BA15703C6
echo "deb http://repo.mongodb.org/apt/debian wheezy/mongodb-org/3.4 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.4.list

apt-get update
apt-get install -y automake autoconf libtool subversion-tools help2man
apt-get install -y build-essential erlang libicu-dev
apt-get install -y checkinstall libmozjs-dev wget
apt-get install -y libcurl4-gnutls-dev
cd /vagrant
apt-get install -y g++
apt-get install -y erlang-base erlang-dev erlang-eunit erlang-nox
apt-get install -y libmozjs185-dev libicu-dev libcurl4-gnutls-dev libtool
cd /tmp
rm apache-couchdb-1.6.1.tar.gz
wget http://mirror.rise.ph/apache/couchdb/source/1.6.1/apache-couchdb-1.6.1.tar.gz
tar -xzvf apache-couchdb-1.6.1.tar.gz
cd apache-couchdb-1.6.1
./configure
make && sudo make install
adduser --disabled-login --disabled-password --no-create-home couchdb
usermod -u 999 couchdb
chown -R couchdb:couchdb /usr/local/var/log/couchdb
chown -R couchdb:couchdb /usr/local/var/lib/couchdb
chown -R couchdb:couchdb /usr/local/var/run/couchdb
chown -R couchdb:couchdb /usr/local/etc/couchdb
ln -s /usr/local/etc/init.d/couchdb  /etc/init.d
update-rc.d couchdb defaults
/etc/init.d/couchdb start

echo "deb http://packages.dotdeb.org wheezy all" > /etc/apt/sources.list.d/dotdeb.list
echo "deb-src http://packages.dotdeb.org wheezy all" >> /etc/apt/sources.list.d/dotdeb.list
cd /tmp
wget http://www.dotdeb.org/dotdeb.gpg
apt-key add dotdeb.gpg
apt-get update
apt-get install -y redis-server

#add host file
cp /vagrant/configs/hosts /etc/.


apt-get install -y mongodb-org
cp /vagrant/configs/couchdb/local.ini /usr/local/etc/couchdb/.
chown -R couchdb:couchdb /usr/local/etc/couchdb
curl -X PUT localhost:5984/_config/admins/replication -d '"r2d2rep"'
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/mailbox
chown -R couchdb:couchdb /vagrant/configs/couchdb/design_documents/
cd /vagrant/configs/couchdb/design_documents/client_docs
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/client --data-binary @client.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/invoice --data-binary @invoice.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/nab --data-binary @nab.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/orders_processing --data-binary @orders_processing.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/reports --data-binary @reports.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/running_balance --data-binary @running_balance.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/timerecord --data-binary @timerecord.json
cd /vagrant/configs/couchdb/design_documents/rssc
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/connected --data-binary @connected.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/dashboard --data-binary @dashboard.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/email_notification --data-binary @email_notification.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/prepaid_monitoring --data-binary @prepaid_monitoring.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/staff --data-binary @staff.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/workflow --data-binary @workflow.json
cd /vagrant/configs/couchdb/design_documents/rssc_time_records
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/hourly_rate --data-binary @hourly_rate.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/logged_in --data-binary @logged_in.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/mysql --data-binary @mysql.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/prepaid --data-binary @prepaid.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/reports --data-binary @reports.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/rssc_reports --data-binary @rssc_reports.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/rssc_time_records --data-binary @rssc_time_records.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/subcon_management --data-binary @subcon_management.json
curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/summary --data-binary @summary.json
sudo service couchdb restart

apt-get install -y build-essential --no-install-recommends
apt-get install -y redis-server --no-install-recommends
apt-get install -y ruby1.9.1-dev --no-install-recommends
apt-get install -y ruby1.9.3 --no-install-recommends
gem install cf

curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
apt-get install -y nodejs
apt-get install -y npm
cd /vagrant/app
npm install -g --save-dev mocha
npm install --save-dev chai
npm install --save-dev supertest
npm install
npm install -g --save sequelize-cli
npm install pm2 -g


