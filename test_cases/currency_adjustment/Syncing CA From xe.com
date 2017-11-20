FEATURE: System syncs currency adjustment from xe.com
SCENARIO1: Xe.com responds with Valid  response
    GIVEN:
        1 AUD converts to 37.70 PHP
        1 GBP converts to 63.13 PHP
        1 USD converts to 49.58 PHP
        Admin:
            Allanaire Tapion
            with ID of 143
    WHEN: saving to our system
        THEN:
            AUD will be (AUD converted to PHP) – 1

                                           Forex Rate for AUD = 36.7

            GBP will be (GBP converted to PHP) – 1.5

            Forex Rate for GBP = 61.63

            USD will be (USD converted to PHP) – 1.5

            Forex Rate for USD = 48.08


SCENARIO2:Xe.com responds with an Invalid Response
    GIVEN:
        1 AUD converts to undefined OR NULL
        1 GBP converts to undefined OR NULL
        1 USD converts to undefined OR NULL
        Admin:
            Allanaire Tapion
            with ID of 143
    WHEN saving to our system
        THEN:
            AUD will be the same as previous

            Forex Rate for AUD = 36.7

            GBP will be the same as previous

            Forex Rate for GBP = 61.63

            USD will be the same as previous

            Forex Rate for USD = 48.08

            Scheduled resyncing from xe.com will be created