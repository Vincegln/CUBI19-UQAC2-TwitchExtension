#include "pch.h"
#include <iostream>
#include "httplib.h"


using namespace std;

int main()
{
	httplib::SSLClient cli("localhost", 8081);

	auto res = cli.Get("/cubi/voteResult");

	if (res == nullptr)
	{
		cerr << "Query failed" << endl;
	}
	if (res && res->status == 200) {
		cout << res->body << endl;
	}
	while (true);
}
